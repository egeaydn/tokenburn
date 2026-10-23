import { homedir } from "node:os";
import { basename, join } from "node:path";
import fg from "fast-glob";
import { z } from "zod";
import { readLines } from "./lines.js";
import type { Provider, UsageRecord } from "./types.js";

const tokens = z
  .number()
  .nullish()
  .transform((v) => v ?? 0);

const usageSchema = z.object({
  input_tokens: tokens,
  cached_input_tokens: tokens,
  cache_write_input_tokens: tokens,
  output_tokens: tokens,
});
type Usage = z.infer<typeof usageSchema>;

const eventSchema = z.object({
  timestamp: z.string(),
  type: z.string(),
  payload: z
    .object({
      type: z.string().optional(),
      id: z.string().optional(),
      cwd: z.string().optional(),
      model: z.string().optional(),
      info: z
        .object({
          total_token_usage: usageSchema,
          last_token_usage: usageSchema.optional(),
        })
        .nullish(),
    })
    .passthrough(),
});

export function defaultCodexDir(): string {
  return process.env.CODEX_HOME?.trim() || join(homedir(), ".codex");
}

const sessionIdOf = (file: string) =>
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl/.exec(basename(file))?.[1];

/**
 * The Codex desktop app starts repo-less chats in a throwaway folder
 * (`.../Codex/<date>/<prompt-slug>`). Those would each show up as their own "project", so
 * they are grouped under one label.
 */
const SCRATCH_CHAT = /[\\/]Codex[\\/]\d{4}-\d{2}-\d{2}[\\/][^\\/]+$/;
export const CODEX_CHATS = "(codex chats)";
export const projectOf = (cwd: string) => (SCRATCH_CHAT.test(cwd) ? CODEX_CHATS : cwd);

const zero: Usage = {
  input_tokens: 0,
  cached_input_tokens: 0,
  cache_write_input_tokens: 0,
  output_tokens: 0,
};

/** True when any counter went down, i.e. the running total was reset (e.g. after compaction). */
const regressed = (prev: Usage, next: Usage) =>
  next.input_tokens < prev.input_tokens || next.output_tokens < prev.output_tokens;

function diff(next: Usage, prev: Usage): Usage {
  return {
    input_tokens: next.input_tokens - prev.input_tokens,
    cached_input_tokens: next.cached_input_tokens - prev.cached_input_tokens,
    cache_write_input_tokens: next.cache_write_input_tokens - prev.cache_write_input_tokens,
    output_tokens: next.output_tokens - prev.output_tokens,
  };
}

/** OpenAI counts cached tokens inside `input_tokens`; split them into our disjoint buckets. */
function toRecord(
  u: Usage,
  ctx: { timestamp: Date; model: string; project: string; sessionId: string },
): UsageRecord {
  const cacheWrite = u.cache_write_input_tokens;
  return {
    timestamp: ctx.timestamp,
    provider: "codex",
    model: ctx.model,
    project: ctx.project,
    sessionId: ctx.sessionId,
    inputTokens: Math.max(0, u.input_tokens - u.cached_input_tokens - cacheWrite),
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cached_input_tokens,
    cacheWrite5mTokens: cacheWrite,
    cacheWrite1hTokens: 0,
  };
}

/** Yields one record per token_count event whose running total changed. */
export async function* readSession(file: string): AsyncGenerator<UsageRecord> {
  let sessionId = sessionIdOf(file) ?? basename(file);
  let project = "(unknown)";
  let model = "(unknown)";
  let prev: Usage = zero;

  for await (const line of readLines(file)) {
    // Cheap pre-filter: sessions hold huge tool outputs we never need to parse.
    if (
      !line.includes('"session_meta"') &&
      !line.includes('"turn_context"') &&
      !line.includes('"token_count"')
    ) {
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      continue;
    }
    const parsed = eventSchema.safeParse(json);
    if (!parsed.success) continue;
    const { type, timestamp, payload } = parsed.data;

    if (type === "session_meta") {
      sessionId = payload.id ?? sessionId;
      project = projectOf(payload.cwd ?? project);
    } else if (type === "turn_context") {
      model = payload.model ?? model;
      project = projectOf(payload.cwd ?? project);
    } else if (type === "event_msg" && payload.type === "token_count" && payload.info) {
      const total = payload.info.total_token_usage;
      // Consecutive events can repeat the same running total: only count what changed.
      const delta = regressed(prev, total)
        ? (payload.info.last_token_usage ?? total)
        : diff(total, prev);
      prev = total;
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) continue;
      if (delta.input_tokens + delta.output_tokens <= 0) continue;
      yield toRecord(delta, { timestamp: date, model, project, sessionId });
    }
  }
}

export function codexProvider(dir: string = defaultCodexDir()): Provider {
  return {
    name: "codex",
    async *read() {
      const root = dir.replaceAll("\\", "/");
      const files = await fg(
        [`${root}/sessions/**/*.jsonl*`, `${root}/archived_sessions/**/*.jsonl*`],
        {
          absolute: true,
          onlyFiles: true,
        },
      );
      // A session can exist both active and archived: read each session id once.
      const seen = new Set<string>();
      for (const file of files.sort()) {
        if (!/\.jsonl(\.zst)?$/.test(file)) continue;
        const id = sessionIdOf(file);
        if (id) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        try {
          yield* readSession(file);
        } catch {
          // Truncated or corrupt file (e.g. a session still being written): keep what we got.
        }
      }
    },
  };
}

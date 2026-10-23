import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import fg from "fast-glob";
import { z } from "zod";
import type { Provider, UsageRecord } from "./types.js";

const tokens = z
  .number()
  .nullish()
  .transform((v) => v ?? 0);

const lineSchema = z.object({
  type: z.literal("assistant"),
  uuid: z.string().optional(),
  timestamp: z.string(),
  cwd: z.string().optional(),
  sessionId: z.string().optional(),
  message: z.object({
    id: z.string().optional(),
    model: z.string(),
    usage: z.object({
      input_tokens: tokens,
      output_tokens: tokens,
      cache_read_input_tokens: tokens,
      cache_creation_input_tokens: tokens,
      cache_creation: z
        .object({
          ephemeral_5m_input_tokens: tokens,
          ephemeral_1h_input_tokens: tokens,
        })
        .nullish(),
    }),
  }),
});

/** Claude Code config dirs: `CLAUDE_CONFIG_DIR` (comma separated) or the two default locations. */
export function defaultClaudeDirs(): string[] {
  const env = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (env) return env.split(",").map((d) => d.trim());
  return [join(homedir(), ".claude"), join(homedir(), ".config", "claude")];
}

export interface ParsedLine {
  /** Dedupe key: the API message id, falling back to the line uuid. */
  id: string | undefined;
  record: UsageRecord;
}

/**
 * Parses one JSONL line, or returns null if it is not a billable assistant line.
 * Malformed or unrecognised lines are skipped, never thrown.
 */
export function parseLine(line: string): ParsedLine | null {
  // Cheap pre-filter: most lines (user, attachments, snapshots) are irrelevant.
  if (!line.includes('"usage"')) return null;
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = lineSchema.safeParse(json);
  if (!parsed.success) return null;
  const { message, timestamp, cwd, sessionId, uuid } = parsed.data;
  if (message.model === "<synthetic>") return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const u = message.usage;
  // `cache_creation` splits writes by TTL; without it everything is the default 5m write.
  const write1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = u.cache_creation
    ? u.cache_creation.ephemeral_5m_input_tokens
    : u.cache_creation_input_tokens;
  const record: UsageRecord = {
    timestamp: date,
    provider: "claude-code",
    model: message.model,
    project: cwd ?? "(unknown)",
    sessionId: sessionId ?? "(unknown)",
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens,
    cacheWrite5mTokens: write5m,
    cacheWrite1hTokens: write1h,
  };
  const total =
    record.inputTokens +
    record.outputTokens +
    record.cacheReadTokens +
    record.cacheWrite5mTokens +
    record.cacheWrite1hTokens;
  return total > 0 ? { id: message.id ?? uuid, record } : null;
}

export function claudeCodeProvider(dirs: string[] = defaultClaudeDirs()): Provider {
  return {
    name: "claude-code",
    async *read() {
      const files = await fg(
        dirs.map((d) => `${d.replaceAll("\\", "/")}/projects/**/*.jsonl`),
        { absolute: true, onlyFiles: true },
      );
      // One API response is written as several lines sharing a message id: count it once.
      const seen = new Set<string>();
      for (const file of files.sort()) {
        const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
        for await (const line of rl) {
          const parsed = parseLine(line);
          if (!parsed) continue;
          if (parsed.id) {
            if (seen.has(parsed.id)) continue;
            seen.add(parsed.id);
          }
          yield parsed.record;
        }
      }
    },
  };
}

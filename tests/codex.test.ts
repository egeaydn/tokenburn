import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate } from "../src/core/aggregate.js";
import { codexProvider } from "../src/providers/codex.js";
import type { UsageRecord } from "../src/providers/types.js";

const fixtureDir = fileURLToPath(new URL("./fixtures/codex", import.meta.url));

async function readAll(): Promise<UsageRecord[]> {
  const out: UsageRecord[] = [];
  for await (const r of codexProvider(fixtureDir).read()) out.push(r);
  return out;
}

describe("codex provider", () => {
  it("reads plain and zstd-compressed sessions", async () => {
    const records = await readAll();
    expect(new Set(records.map((r) => r.sessionId)).size).toBe(2);
    expect(records).toHaveLength(8); // 4 per session
  });

  it("splits cached tokens out of input and skips repeated totals", async () => {
    const [first, second] = await readAll();
    expect(first).toMatchObject({
      provider: "codex",
      model: "gpt-5.6-luna",
      project: "/work/codex-repo",
      inputTokens: 400, // 1000 input - 600 cached
      cacheReadTokens: 600,
      outputTokens: 100,
    });
    // The duplicated total, null info and broken line produced no extra record.
    expect(second).toMatchObject({ inputTokens: 300, cacheReadTokens: 1200, outputTokens: 200 });
  });

  it("follows the model of the latest turn_context", async () => {
    const records = await readAll();
    expect(records.filter((r) => r.model === "gpt-6-mystery")).toHaveLength(4);
  });

  it("restarts counting when the running total resets", async () => {
    const records = (await readAll()).filter((r) => r.sessionId.endsWith("0001"));
    // 400/50 after a reset, then +500/+40 on top of it
    expect(records.slice(2).map((r) => [r.inputTokens, r.outputTokens])).toEqual([
      [400, 50],
      [500, 40],
    ]);
  });

  it("aggregates cost and flags models without a price", async () => {
    const rows = await aggregate(codexProvider(fixtureDir).read(), "day");
    expect(rows.map((r) => r.key)).toEqual(["2026-10-12", "2026-10-13"]);
    expect(rows[0]?.unpricedModels).toEqual(["gpt-6-mystery"]);
    expect(rows[0]?.costUSD).toBeGreaterThan(0);
  });
});

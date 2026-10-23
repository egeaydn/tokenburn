import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { claudeCodeProvider, parseLine } from "../src/providers/claude-code.js";
import type { UsageRecord } from "../src/providers/types.js";

const fixtureDir = fileURLToPath(new URL("./fixtures/claude", import.meta.url));

async function readAll(): Promise<UsageRecord[]> {
  const out: UsageRecord[] = [];
  // fixtureDir mimics a Claude config dir: it contains `projects/`.
  for await (const r of claudeCodeProvider([fixtureDir]).read()) out.push(r);
  return out;
}

describe("claude-code provider", () => {
  it("counts a response split over several lines only once", async () => {
    const records = await readAll();
    expect(records.filter((r) => r.outputTokens === 100)).toHaveLength(1);
  });

  it("skips malformed, synthetic, undated and non-usage lines", async () => {
    const records = await readAll();
    // msg_1, msg_2, msg_3, msg_4: everything else must be dropped
    expect(records).toHaveLength(4);
  });

  it("splits cache writes by TTL", async () => {
    const [first] = await readAll();
    expect(first).toMatchObject({
      model: "claude-sonnet-5-5",
      project: "/work/demo-repo",
      sessionId: "s1",
      inputTokens: 10,
      outputTokens: 100,
      cacheReadTokens: 1000,
      cacheWrite5mTokens: 0,
      cacheWrite1hTokens: 500,
    });
  });

  it("treats legacy cache_creation_input_tokens as 5m writes", async () => {
    const records = await readAll();
    const opus = records.find((r) => r.model === "claude-opus-5-5");
    expect(opus).toMatchObject({ cacheWrite5mTokens: 11914, cacheWrite1hTokens: 0 });
  });

  it("falls back to an unknown project when cwd is missing", async () => {
    const records = await readAll();
    expect(records.find((r) => r.inputTokens === 5)?.project).toBe("(unknown)");
  });

  it("parseLine never throws on garbage", () => {
    expect(parseLine("")).toBeNull();
    expect(parseLine("{")).toBeNull();
    expect(parseLine('{"usage": 1}')).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { costOf, findPrice } from "../src/core/pricing.js";
import type { UsageRecord } from "../src/providers/types.js";

const base: UsageRecord = {
  timestamp: new Date("2026-10-12T12:00:00Z"),
  provider: "claude-code",
  model: "claude-opus-5-5",
  project: "/p",
  sessionId: "s",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
};

describe("pricing", () => {
  it("matches the cost Claude Code recorded for a real opus session", () => {
    // Tokens and costUSD copied from a real `cost-state` log line (1h cache writes).
    const cost = costOf({
      ...base,
      inputTokens: 2,
      outputTokens: 27,
      cacheReadTokens: 28733,
      cacheWrite1hTokens: 11914,
    });
    expect(cost).toBeCloseTo(0.1016066, 6);
  });

  it("matches the cost Claude Code recorded for a large sonnet session", () => {
    const cost = costOf({
      ...base,
      model: "claude-sonnet-5-5",
      inputTokens: 164,
      outputTokens: 51845,
      cacheReadTokens: 10184710,
      cacheWrite1hTokens: 307802,
    });
    expect(cost).toBeCloseTo(2.768457, 6);
  });

  it("returns null for unknown models instead of guessing", () => {
    expect(costOf({ ...base, model: "future-model-9", inputTokens: 1000 })).toBeNull();
  });

  it("ignores a trailing date suffix when looking up a price", () => {
    expect(findPrice("claude-opus-5-5-20260101")).toEqual(findPrice("claude-opus-5-5"));
    expect(findPrice("nope-20260101")).toBeUndefined();
  });
});

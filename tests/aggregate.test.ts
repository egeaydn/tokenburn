import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate, bucketKey, totalOf } from "../src/core/aggregate.js";
import { claudeCodeProvider } from "../src/providers/claude-code.js";

const fixtureDir = fileURLToPath(new URL("./fixtures/claude", import.meta.url));
const records = () => claudeCodeProvider([fixtureDir]).read();

describe("aggregate", () => {
  it("buckets by local day and month", () => {
    const d = new Date(2026, 9, 5, 12); // local noon, 5 Oct 2026
    expect(bucketKey(d, "day")).toBe("2026-10-05");
    expect(bucketKey(d, "month")).toBe("2026-10");
  });

  it("groups the fixture into two days and sums tokens", async () => {
    const rows = await aggregate(records(), "day");
    expect(rows.map((r) => r.key)).toEqual(["2026-10-12", "2026-11-02"]);
    const nov = rows[1];
    expect(nov?.inputTokens).toBe(2 + 1000 + 5);
  });

  it("flags unpriced models and keeps them out of the cost", async () => {
    const rows = await aggregate(records(), "month");
    const nov = rows.find((r) => r.key === "2026-11");
    expect(nov?.unpricedModels).toEqual(["future-model-9"]);
    expect(nov?.costUSD).toBeGreaterThan(0);
  });

  it("totals all rows", async () => {
    const rows = await aggregate(records(), "day");
    const total = totalOf(rows);
    expect(total.costUSD).toBeCloseTo(
      rows.reduce((s, r) => s + r.costUSD, 0),
      10,
    );
    expect(total.unpricedModels).toEqual(["future-model-9"]);
  });

  it("groups by model, biggest spender first, and tracks net cache savings", async () => {
    const rows = await aggregate(records(), "model");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((r) => r.costUSD)).toEqual(
      [...rows.map((r) => r.costUSD)].sort((a, b) => b - a),
    );
    expect(rows.every((r) => r.models.length === 1 && r.models[0] === r.key)).toBe(true);
    const total = totalOf(rows);
    expect(total.cacheSavedUSD).toBeCloseTo(
      rows.reduce((s, r) => s + r.cacheSavedUSD, 0),
      10,
    );
  });
});

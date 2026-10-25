import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { aggregate, totalOf } from "../src/core/aggregate.js";
import { filterByDate, filterByModel, parseDate, parseLast } from "../src/core/filter.js";
import { renderJson } from "../src/output/json.js";
import { claudeCodeProvider } from "../src/providers/claude-code.js";
import { selectProviders } from "../src/providers/index.js";
import type { UsageRecord } from "../src/providers/types.js";

const fixtureDir = fileURLToPath(new URL("./fixtures/claude", import.meta.url));
const records = () => claudeCodeProvider([fixtureDir]).read();

describe("parseDate", () => {
  it("accepts YYYY-MM-DD and YYYYMMDD as local dates", () => {
    expect(parseDate("2026-10-05")).toEqual(new Date(2026, 9, 5));
    expect(parseDate("20261005")).toEqual(new Date(2026, 9, 5));
  });

  it("returns the last millisecond of the day for an upper bound", () => {
    expect(parseDate("2026-10-05", true)).toEqual(new Date(2026, 9, 5, 23, 59, 59, 999));
  });

  it("rejects garbage and impossible dates", () => {
    expect(() => parseDate("yesterday")).toThrow(/Invalid date/);
    expect(() => parseDate("2026-02-31")).toThrow(/Invalid date/);
    expect(() => parseDate("2026-13-01")).toThrow(/Invalid date/);
  });
});

describe("filterByDate", () => {
  const days = async (range: Parameters<typeof filterByDate>[1]) =>
    (await aggregate(filterByDate(records(), range), "day")).map((r) => r.key);

  it("keeps everything without bounds", async () => {
    expect(await days({})).toEqual(["2026-10-12", "2026-11-02"]);
  });

  it("applies --since inclusively", async () => {
    expect(await days({ since: parseDate("2026-11-02") })).toEqual(["2026-11-02"]);
  });

  it("applies --until inclusively, covering the whole day", async () => {
    expect(await days({ until: parseDate("2026-10-12", true) })).toEqual(["2026-10-12"]);
    expect(
      await days({ since: parseDate("2026-10-13"), until: parseDate("2026-11-01", true) }),
    ).toEqual([]);
  });
});

describe("selectProviders", () => {
  it("returns every provider by default", () => {
    expect(selectProviders().map((p) => p.name)).toEqual(["claude-code", "codex"]);
  });

  it("selects by name and rejects unknown names", () => {
    expect(selectProviders(["codex"]).map((p) => p.name)).toEqual(["codex"]);
    expect(() => selectProviders(["cursor"])).toThrow(/Unknown provider "cursor"/);
  });
});

describe("renderJson", () => {
  it("emits rows and a total without the row key", async () => {
    const rows = await aggregate(records(), "month");
    const parsed = JSON.parse(renderJson(rows, totalOf(rows)));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.total).not.toHaveProperty("key");
    expect(parsed.total.unpricedModels).toEqual(["future-model-9"]);
    expect(parsed.total.costUSD).toBeCloseTo(
      parsed.rows.reduce((s: number, r: { costUSD: number }) => s + r.costUSD, 0),
      10,
    );
  });
});

describe("parseLast", () => {
  const now = new Date(2026, 9, 25, 15, 30);
  it("includes today in the span", () => {
    expect(parseLast("1d", now)).toEqual(new Date(2026, 9, 25));
    expect(parseLast("7d", now)).toEqual(new Date(2026, 9, 19));
    expect(parseLast("2w", now)).toEqual(new Date(2026, 9, 12));
  });
  it("rejects bad input", () => {
    for (const bad of ["0d", "7", "d", "7m", "-1d"]) expect(() => parseLast(bad, now)).toThrow();
  });
});

describe("filterByModel", () => {
  it("keeps records whose model contains any name, ignoring case", async () => {
    const rec = (model: string) => ({ model }) as UsageRecord;
    async function* src() {
      yield* [rec("claude-opus-4"), rec("claude-sonnet-4"), rec("gpt-5")];
    }
    const out: string[] = [];
    for await (const r of filterByModel(src(), ["OPUS", "gpt"])) out.push(r.model);
    expect(out).toEqual(["claude-opus-4", "gpt-5"]);
  });
});

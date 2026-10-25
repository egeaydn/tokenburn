import { describe, expect, it } from "vitest";
import { type Row, totalOf } from "../src/core/aggregate.js";
import { renderCsv } from "../src/output/csv.js";

const header =
  "key,models,providers,inputTokens,outputTokens,cacheReadTokens,cacheWriteTokens,costUSD,unpricedModels";
const row = (overrides: Partial<Row> = {}): Row => ({
  key: "2026-10-12",
  models: [],
  providers: [],
  inputTokens: 1000,
  outputTokens: 200,
  cacheReadTokens: 300,
  cacheWriteTokens: 400,
  costUSD: 0.1234567,
  unpricedModels: [],
  ...overrides,
});

describe("renderCsv", () => {
  it("exports a header, every row and a total with unformatted numbers", () => {
    const rows = [row(), row({ key: "2026-11-02", costUSD: 0.2 })];
    expect(renderCsv(rows, totalOf(rows))).toBe(
      [
        header,
        "2026-10-12,[],[],1000,200,300,400,0.1234567,[]",
        "2026-11-02,[],[],1000,200,300,400,0.2,[]",
        `Total,[],[],2000,400,600,800,${0.1234567 + 0.2},[]`,
      ].join("\r\n"),
    );
  });

  it.each([
    ["C:/work/client,app", '"C:/work/client,app"'],
    ['C:/work/"quoted"', '"C:/work/""quoted"""'],
    ["/work/line\nbreak", '"/work/line\nbreak"'],
    ["/work/line\rbreak", '"/work/line\rbreak"'],
    ["/work/line\r\nbreak", '"/work/line\r\nbreak"'],
    ["C:/work/日本語", "C:/work/日本語"],
    ["", ""],
  ])("preserves and escapes the project key %j", (key, escaped) => {
    const rows = [row({ key })];
    expect(renderCsv(rows, totalOf(rows))).toContain(`\r\n${escaped},[],[],1000,`);
    expect(rows[0]?.key).toBe(key);
  });

  it("keeps models, providers and unknown-price warnings as JSON arrays in CSV cells", () => {
    const rows = [
      row({
        models: ["known", "future,model"],
        providers: ["claude-code", "codex"],
        unpricedModels: ["future,model"],
      }),
    ];
    const lists = '"[""known"",""future,model""]","[""claude-code"",""codex""]"';
    const csv = renderCsv(rows, totalOf(rows));
    expect(csv).toContain(
      `\r\n2026-10-12,${lists},1000,200,300,400,0.1234567,"[""future,model""]"`,
    );
    expect(csv).toContain(`\r\nTotal,${lists},1000,200,300,400,0.1234567,"[""future,model""]"`);
  });

  it("exports a header and zero total when there are no rows", () => {
    expect(renderCsv([], totalOf([]))).toBe(`${header}\r\nTotal,[],[],0,0,0,0,0,[]`);
  });
});

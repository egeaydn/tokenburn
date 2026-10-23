import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildReport } from "../src/core/report.js";
import { renderHtml } from "../src/output/html.js";
import { claudeCodeProvider } from "../src/providers/claude-code.js";
import type { UsageRecord } from "../src/providers/types.js";

const fixtureDir = fileURLToPath(new URL("./fixtures/claude", import.meta.url));

const rec = (over: Partial<UsageRecord>): UsageRecord => ({
  timestamp: new Date(2026, 9, 12, 12),
  provider: "claude-code",
  model: "claude-sonnet-5-5",
  project: "/work/app",
  sessionId: "s",
  inputTokens: 1_000_000,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
  ...over,
});

describe("buildReport", () => {
  it("fills days without usage so the chart has no gaps", async () => {
    const data = await buildReport(claudeCodeProvider([fixtureDir]).read());
    expect(data.granularity).toBe("day");
    expect(data.range).toEqual({ from: "2026-10-12", to: "2026-11-02" });
    expect(data.series).toHaveLength(22); // 12 Oct .. 2 Nov inclusive
    expect(data.series[1]?.costUSD).toBe(0);
    expect(data.totals.activeDays).toBe(2);
    expect(data.totals.unpricedModels).toEqual(["future-model-9"]);
    expect(data.byModel.find((m) => m.name === "future-model-9")?.partial).toBe(true);
  });

  it("stacks cost per tool and totals match the series", async () => {
    const data = await buildReport([rec({}), rec({ provider: "codex", model: "gpt-5.6-luna" })]);
    expect(data.providers).toEqual(["claude-code", "codex"]);
    const point = data.series[0];
    expect(point?.byProvider["claude-code"]).toBeCloseTo(2, 6); // 1M input at $2/M
    expect(data.totals.costUSD).toBeCloseTo(point?.costUSD ?? 0, 10);
  });

  it("switches to monthly bars for very long ranges", async () => {
    const data = await buildReport([
      rec({ timestamp: new Date(2024, 0, 5) }),
      rec({ timestamp: new Date(2026, 9, 5) }),
    ]);
    expect(data.granularity).toBe("month");
    expect(data.series[0]?.key).toBe("2024-01");
    expect(data.series.at(-1)?.key).toBe("2026-10");
    expect(data.series).toHaveLength(34);
  });

  it("anonymizes project names", async () => {
    const data = await buildReport([rec({ project: "/secret/client-x" })], { anonymize: true });
    expect(data.byProject.map((p) => p.name)).toEqual(["Project 1"]);
  });

  it("handles no data at all", async () => {
    const data = await buildReport([]);
    expect(data.range).toBeNull();
    expect(data.series).toEqual([]);
  });
});

describe("renderHtml", () => {
  it("is one self-contained page with system, light and dark themes", async () => {
    const html = renderHtml(await buildReport([rec({})]));
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('data-theme="system"');
  });

  it("makes no network requests", async () => {
    const html = renderHtml(await buildReport([rec({})]));
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/(?:src|href)=["']https?:/i);
    expect(html).not.toMatch(/@import|url\(/i);
  });

  it("cannot be broken out of by hostile project names", async () => {
    const evil = "/x/</script><img src=x onerror=alert(1)>";
    const html = renderHtml(await buildReport([rec({ project: evil })]));
    expect(html).not.toContain("<img src=x");
    expect(html.match(/<\/script>/g)).toHaveLength(2); // only our own two script tags
  });

  it("renders the empty state", async () => {
    const html = renderHtml(await buildReport([]));
    expect(html).toContain("No usage found for this period.");
  });
});

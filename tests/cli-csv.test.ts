import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Row } from "../src/core/aggregate.js";
import { renderCsv } from "../src/output/csv.js";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const fixtureDir = fileURLToPath(new URL("./fixtures/claude", import.meta.url));

function run(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", cli, ...args, "--provider", "claude-code"],
    {
      encoding: "utf8",
      timeout: 15_000,
      // Select only the fixture provider, so subprocesses never inspect personal session logs.
      env: { ...process.env, CLAUDE_CONFIG_DIR: fixtureDir, TZ: "UTC" },
    },
  );
}

describe("CLI CSV output", () => {
  it.each(["daily", "monthly", "project"])(
    "exports the same %s rows and totals as JSON",
    (command) => {
      const csv = run([command, "--csv"]);
      const json = run([command, "--json"]);
      expect(csv.error).toBeUndefined();
      expect(csv.status).toBe(0);
      expect(csv.stderr).toBe("");
      expect(json.status).toBe(0);
      const data = JSON.parse(json.stdout) as { rows: Row[]; total: Omit<Row, "key"> };
      expect(data.rows.length).toBeGreaterThan(0);
      expect(csv.stdout).toBe(`${renderCsv(data.rows, { key: "Total", ...data.total })}\n`);
    },
    30_000,
  );

  it("prints CSV for the default daily command", () => {
    const implicit = run(["--csv"]);
    const explicit = run(["daily", "--csv"]);
    expect(implicit.status).toBe(0);
    expect(explicit.status).toBe(0);
    expect(implicit.stdout).toBe(explicit.stdout);
  }, 30_000);

  it("prints a header and zero total after a date filter excludes all rows", () => {
    const result = run(["daily", "--csv", "--since", "2099-01-01"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("key,models,providers,inputTokens,");
    expect(result.stdout).toContain("\r\nTotal,[],[],0,0,0,0,0,0,[]\n");
    expect(result.stdout).not.toContain("No usage data found.");
  });

  it.each([
    ["--csv", "--json"],
    ["--json", "--csv"],
  ])("rejects conflicting formats %s %s", (first, second) => {
    const result = run(["daily", first, second]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot be used with option");
  });
});

describe("CLI --budget", () => {
  it("exits 1 with a stderr warning when spend exceeds the budget", () => {
    const result = run(["daily", "--json", "--budget", "0"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Over budget");
    expect(() => JSON.parse(result.stdout)).not.toThrow();
  }, 30_000);

  it("exits 0 when spend is within the budget", () => {
    const result = run(["daily", "--budget", "1000000"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  }, 30_000);

  it("rejects a non-numeric budget", () => {
    const result = run(["daily", "--budget", "abc"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--budget");
  }, 30_000);
});

describe("CLI model, --top, --last, --model", () => {
  it("lists models and limits rows with --top while keeping the full total", () => {
    const all = JSON.parse(run(["model", "--json"]).stdout);
    const top = JSON.parse(run(["model", "--json", "--top", "1"]).stdout);
    expect(all.rows.length).toBeGreaterThan(1);
    expect(top.rows).toEqual(all.rows.slice(0, 1));
    expect(top.total).toEqual(all.total);
  }, 30_000);

  it("filters by model substring", () => {
    const data = JSON.parse(run(["model", "--json", "--model", "future"]).stdout);
    expect(data.rows.map((r: Row) => r.key)).toEqual(["future-model-9"]);
  }, 30_000);

  it("today/week run, and --last conflicts with --since", () => {
    expect(run(["today"]).status).toBe(0);
    expect(run(["week", "--json"]).status).toBe(0);
    const bad = run(["daily", "--last", "7d", "--since", "2026-01-01"]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain("--last");
  }, 30_000);
});

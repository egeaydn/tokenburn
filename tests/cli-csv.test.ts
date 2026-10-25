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
    expect(result.stdout).toContain("\r\nTotal,[],[],0,0,0,0,0,[]\n");
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

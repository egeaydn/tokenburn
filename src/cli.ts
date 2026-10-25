import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command, Option } from "commander";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { aggregate, type GroupBy, totalOf } from "./core/aggregate.js";
import { filterByDate, parseDate } from "./core/filter.js";
import { shortenPaths } from "./core/paths.js";
import { buildReport } from "./core/report.js";
import { renderCsv } from "./output/csv.js";
import { renderHtml } from "./output/html.js";
import { renderJson } from "./output/json.js";
import { renderTable } from "./output/table.js";
import { providerNames, selectProviders } from "./providers/index.js";
import type { UsageRecord } from "./providers/types.js";

interface Options {
  since?: string;
  until?: string;
  provider?: string;
  json?: boolean;
  csv?: boolean;
}

interface ReportOptions extends Options {
  output: string;
  open?: boolean;
  anonymize?: boolean;
}

/** Shared `--since/--until/--provider` handling. */
function selectRecords(opts: Options) {
  const since = opts.since ? parseDate(opts.since) : undefined;
  const until = opts.until ? parseDate(opts.until, true) : undefined;
  if (since && until && since > until) throw new Error("--since must not be after --until.");
  const names = opts.provider?.split(",").map((s) => s.trim());
  return filterByDate(allRecords(names), { since, until });
}

function openInBrowser(file: string) {
  const [cmd, args]: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", file]]
      : process.platform === "darwin"
        ? ["open", [file]]
        : ["xdg-open", [file]];
  spawn(cmd, args, { detached: true, stdio: "ignore" })
    .on("error", () => {})
    .unref();
}

async function report(opts: ReportOptions) {
  const data = await buildReport(selectRecords(opts), { anonymize: opts.anonymize });
  const file = resolve(opts.output);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderHtml(data));
  console.log(`${pc.green("Report written:")} ${file}`);
  console.log(pc.dim("Generated locally. The file makes no network requests."));
  if (opts.open) openInBrowser(file);
}

async function* allRecords(names: string[] | undefined): AsyncGenerator<UsageRecord> {
  for (const p of selectProviders(names)) yield* p.read();
}

async function run(by: GroupBy, label: string, opts: Options) {
  const rows = await aggregate(selectRecords(opts), by);
  if (opts.json) {
    console.log(renderJson(rows, totalOf(rows)));
  } else if (opts.csv) {
    console.log(renderCsv(rows, totalOf(rows)));
  } else if (rows.length === 0) {
    console.log(pc.yellow("No usage data found."));
  } else {
    const isProject = by === "project";
    const short = isProject ? shortenPaths(rows.map((r) => r.key)) : undefined;
    console.log(
      renderTable(rows, totalOf(rows), {
        label,
        detail: isProject ? "tools" : "models",
        displayKey: short && ((key) => short.get(key) ?? key),
      }),
    );
  }
}

function withFilters(cmd: Command): Command {
  return cmd
    .option("--since <date>", "only usage on or after this day (YYYY-MM-DD)")
    .option("--until <date>", "only usage on or before this day (YYYY-MM-DD)")
    .option("--provider <names>", `comma separated: ${providerNames.join(", ")}`);
}

function withCommonOptions(cmd: Command): Command {
  return withFilters(cmd)
    .option("--json", "machine readable output")
    .addOption(
      new Option("--csv", "comma-separated output with a header and total").conflicts("json"),
    );
}

const program = new Command();
program
  .name("tokenburn")
  .description("Local spend tracker for AI coding tools. Nothing leaves your machine.")
  .version(pkg.version);

withCommonOptions(
  program.command("daily", { isDefault: true }).description("Usage and cost per day (default)"),
).action((o) => run("day", "Date", o));
withCommonOptions(program.command("monthly").description("Usage and cost per month")).action((o) =>
  run("month", "Month", o),
);

withCommonOptions(
  program.command("project").description("Usage and cost per project (working directory)"),
).action((o) => run("project", "Project", o));

withFilters(
  program.command("report").description("Write a self-contained HTML report (works offline)"),
)
  .option("-o, --output <file>", "where to write the report", "tokenburn-report.html")
  .option("--open", "open the report in your browser when done")
  .option("--anonymize", "replace project names with Project 1, 2, ... for safe sharing")
  .action((o) => report(o));

try {
  await program.parseAsync();
} catch (err) {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
}

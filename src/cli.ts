import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command, InvalidArgumentError, Option } from "commander";
import pc from "picocolors";
import pkg from "../package.json" with { type: "json" };
import { aggregate, type GroupBy, totalOf } from "./core/aggregate.js";
import { filterByDate, filterByModel, parseDate, parseLast } from "./core/filter.js";
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
  budget?: number;
  last?: string;
  model?: string;
  top?: number;
}

interface ReportOptions extends Options {
  output: string;
  open?: boolean;
  anonymize?: boolean;
}

function selectRecords(opts: Options) {
  if (opts.last && (opts.since || opts.until)) {
    throw new Error("--last cannot be combined with --since or --until.");
  }
  const since = opts.last ? parseLast(opts.last) : opts.since ? parseDate(opts.since) : undefined;
  const until = opts.until ? parseDate(opts.until, true) : undefined;
  if (since && until && since > until) throw new Error("--since must not be after --until.");
  const names = opts.provider?.split(",").map((s) => s.trim());
  const dated = filterByDate(allRecords(names), { since, until });
  return opts.model
    ? filterByModel(
        dated,
        opts.model.split(",").map((s) => s.trim()),
      )
    : dated;
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
  const total = totalOf(rows);
  const spent = total.costUSD;
  const shown = opts.top ? rows.slice(0, opts.top) : rows;
  if (opts.json) {
    console.log(renderJson(shown, total));
  } else if (opts.csv) {
    console.log(renderCsv(shown, total));
  } else if (rows.length === 0) {
    console.log(pc.yellow("No usage data found."));
  } else {
    const isProject = by === "project";
    const short = isProject ? shortenPaths(shown.map((r) => r.key)) : undefined;
    console.log(
      renderTable(shown, total, {
        label,
        detail: isProject || by === "model" ? "tools" : "models",
        displayKey: short && ((key) => short.get(key) ?? key),
      }),
    );
  }
  // stderr keeps --json/--csv stdout parseable; exit 1 lets CI fail on overspend.
  if (opts.budget !== undefined && spent > opts.budget) {
    console.error(
      pc.red(`Over budget: $${spent.toFixed(2)} spent, limit $${opts.budget.toFixed(2)}.`),
    );
    process.exitCode = 1;
  }
}

function parseTop(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new InvalidArgumentError("must be a positive integer.");
  return n;
}

function parseBudget(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new InvalidArgumentError("must be a non-negative number.");
  return n;
}

function withFilters(cmd: Command): Command {
  return cmd
    .option("--since <date>", "only usage on or after this day (YYYY-MM-DD)")
    .option("--until <date>", "only usage on or before this day (YYYY-MM-DD)")
    .option("--provider <names>", `comma separated: ${providerNames.join(", ")}`)
    .option("--model <names>", "only models whose name contains one of these (comma separated)")
    .option("--last <n>", "only the last N days (7d) or weeks (2w), today included");
}

function withCommonOptions(cmd: Command): Command {
  return withFilters(cmd)
    .option("--json", "machine readable output")
    .addOption(
      new Option("--csv", "comma-separated output with a header and total").conflicts("json"),
    )
    .option(
      "--top <n>",
      "show only the first n rows (biggest spenders for project/model)",
      parseTop,
    )
    .option("--budget <usd>", "exit with code 1 if total cost exceeds this amount", parseBudget);
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

withCommonOptions(program.command("model").description("Usage and cost per model")).action((o) =>
  run("model", "Model", o),
);

withCommonOptions(program.command("today").description("Usage and cost for today")).action((o) =>
  run("day", "Date", { ...o, last: "1d" }),
);
withCommonOptions(program.command("week").description("Usage and cost for the last 7 days")).action(
  (o) => run("day", "Date", { ...o, last: "7d" }),
);

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

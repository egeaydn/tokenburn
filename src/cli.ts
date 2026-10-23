import { Command } from "commander";
import pc from "picocolors";
import { aggregate, type GroupBy, totalOf } from "./core/aggregate.js";
import { filterByDate, parseDate } from "./core/filter.js";
import { renderJson } from "./output/json.js";
import { renderTable, shortenPaths } from "./output/table.js";
import { providerNames, selectProviders } from "./providers/index.js";
import type { UsageRecord } from "./providers/types.js";

interface Options {
  since?: string;
  until?: string;
  provider?: string;
  json?: boolean;
}

async function* allRecords(names: string[] | undefined): AsyncGenerator<UsageRecord> {
  for (const p of selectProviders(names)) yield* p.read();
}

async function run(by: GroupBy, label: string, opts: Options) {
  const since = opts.since ? parseDate(opts.since) : undefined;
  const until = opts.until ? parseDate(opts.until, true) : undefined;
  if (since && until && since > until) throw new Error("--since must not be after --until.");
  const names = opts.provider?.split(",").map((s) => s.trim());

  const records = filterByDate(allRecords(names), { since, until });
  const rows = await aggregate(records, by);
  if (opts.json) {
    console.log(renderJson(rows, totalOf(rows)));
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

function withCommonOptions(cmd: Command): Command {
  return cmd
    .option("--since <date>", "only usage on or after this day (YYYY-MM-DD)")
    .option("--until <date>", "only usage on or before this day (YYYY-MM-DD)")
    .option("--provider <names>", `comma separated: ${providerNames.join(", ")}`)
    .option("--json", "machine readable output");
}

const program = new Command();
program
  .name("tokenburn")
  .description("Local spend tracker for AI coding tools. Nothing leaves your machine.")
  .version("0.0.0");

withCommonOptions(program.command("daily").description("Usage and cost per day")).action((o) =>
  run("day", "Date", o),
);
withCommonOptions(program.command("monthly").description("Usage and cost per month")).action((o) =>
  run("month", "Month", o),
);

withCommonOptions(
  program.command("project").description("Usage and cost per project (working directory)"),
).action((o) => run("project", "Project", o));

try {
  await program.parseAsync();
} catch (err) {
  console.error(pc.red(err instanceof Error ? err.message : String(err)));
  process.exitCode = 1;
}

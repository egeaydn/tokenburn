import { Command } from "commander";
import pc from "picocolors";
import { aggregate, type GroupBy, totalOf } from "./core/aggregate.js";
import { renderTable } from "./output/table.js";
import { claudeCodeProvider } from "./providers/claude-code.js";
import type { Provider } from "./providers/types.js";

async function* allRecords(providers: Provider[]) {
  for (const p of providers) yield* p.read();
}

async function run(by: GroupBy, label: string) {
  const rows = await aggregate(allRecords([claudeCodeProvider()]), by);
  if (rows.length === 0) {
    console.log(pc.yellow("No usage data found."));
    return;
  }
  console.log(renderTable(rows, totalOf(rows), label));
}

const program = new Command();
program
  .name("tokenburn")
  .description("Local spend tracker for AI coding tools. Nothing leaves your machine.")
  .version("0.0.0");

program
  .command("daily")
  .description("Usage and cost per day")
  .action(() => run("day", "Date"));

program
  .command("monthly")
  .description("Usage and cost per month")
  .action(() => run("month", "Month"));

await program.parseAsync();

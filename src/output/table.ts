import Table from "cli-table3";
import pc from "picocolors";
import type { Row } from "../core/aggregate.js";

const num = (n: number) => n.toLocaleString("en-US");

function cost(row: Row): string {
  const base = `$${row.costUSD.toFixed(2)}`;
  return row.unpricedModels.length > 0 ? `${base}*` : base;
}

/** Strips the vendor prefix to keep the models column narrow. */
const shortModel = (m: string) => m.replace(/^claude-/, "");

export interface TableOptions {
  /** Header of the first column ("Date", "Month", "Project"). */
  label: string;
  /** Second column: the models used, or the tools they ran in. */
  detail: "models" | "tools";
  /** Maps a row key to what is printed in the first column. */
  displayKey?: (key: string) => string;
}

export function renderTable(rows: Row[], total: Row, opts: TableOptions): string {
  const table = new Table({
    head: [
      opts.label,
      opts.detail === "models" ? "Models" : "Tools",
      "Input",
      "Output",
      "Cache Read",
      "Cache Write",
      "Cost",
    ].map((h) => pc.cyan(h)),
    colAligns: ["left", "left", "right", "right", "right", "right", "right"],
    style: { head: [], border: [] },
  });
  const detail = (r: Row) =>
    opts.detail === "models" ? r.models.map(shortModel).join("\n") : r.providers.join("\n");
  for (const r of rows) {
    table.push([
      opts.displayKey ? opts.displayKey(r.key) : r.key,
      detail(r),
      num(r.inputTokens),
      num(r.outputTokens),
      num(r.cacheReadTokens),
      num(r.cacheWriteTokens),
      cost(r),
    ]);
  }
  table.push([
    pc.bold("Total"),
    "",
    pc.bold(num(total.inputTokens)),
    pc.bold(num(total.outputTokens)),
    pc.bold(num(total.cacheReadTokens)),
    pc.bold(num(total.cacheWriteTokens)),
    pc.bold(pc.yellow(cost(total))),
  ]);
  let out = table.toString();
  if (total.unpricedModels.length > 0) {
    out += `\n${pc.dim(`* price unknown for: ${total.unpricedModels.join(", ")} (not included in cost)`)}`;
  }
  return out;
}

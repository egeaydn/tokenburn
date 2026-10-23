import Table from "cli-table3";
import pc from "picocolors";
import type { Row } from "../core/aggregate.js";

const num = (n: number) => n.toLocaleString("en-US");

function cost(row: Row): string {
  const base = `$${row.costUSD.toFixed(2)}`;
  return row.unpricedModels.length > 0 ? `${base}*` : base;
}

/** Strips the `claude-` prefix to keep the models column narrow. */
const shortModel = (m: string) => m.replace(/^claude-/, "");

export function renderTable(rows: Row[], total: Row, firstColumn: string): string {
  const table = new Table({
    head: [firstColumn, "Models", "Input", "Output", "Cache Read", "Cache Write", "Cost"].map((h) =>
      pc.cyan(h),
    ),
    colAligns: ["left", "left", "right", "right", "right", "right", "right"],
    style: { head: [], border: [] },
  });
  for (const r of rows) {
    table.push([
      r.key,
      r.models.map(shortModel).join("\n"),
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

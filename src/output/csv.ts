import type { Row } from "../core/aggregate.js";

const columns: (keyof Row)[] = [
  "key",
  "models",
  "providers",
  "inputTokens",
  "outputTokens",
  "cacheReadTokens",
  "cacheWriteTokens",
  "costUSD",
  "unpricedModels",
];

function field(value: Row[keyof Row]): string {
  // JSON preserves list boundaries, including unknown-price models, inside one CSV cell.
  const text = Array.isArray(value) ? JSON.stringify(value) : String(value);
  return /[,"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function renderCsv(rows: Row[], total: Row): string {
  return [
    columns.join(","),
    ...[...rows, total].map((row) => columns.map((column) => field(row[column])).join(",")),
  ].join("\r\n");
}

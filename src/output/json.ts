import type { Row } from "../core/aggregate.js";

export function renderJson(rows: Row[], total: Row): string {
  const { key: _ignored, ...totals } = total;
  return JSON.stringify({ rows, total: totals }, null, 2);
}

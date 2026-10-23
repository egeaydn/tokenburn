import type { UsageRecord } from "../providers/types.js";
import { costOf, defaultPrices, type PriceTable } from "./pricing.js";

export type GroupBy = "day" | "month";

export interface Row {
  key: string;
  models: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Sum of the costs we could price. */
  costUSD: number;
  /** Models seen in this row that have no known price. */
  unpricedModels: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time bucket key, so "today" matches the user's wall clock. */
export function bucketKey(date: Date, by: GroupBy): string {
  const ym = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return by === "month" ? ym : `${ym}-${pad(date.getDate())}`;
}

export async function aggregate(
  records: AsyncIterable<UsageRecord> | Iterable<UsageRecord>,
  by: GroupBy,
  prices: PriceTable = defaultPrices,
): Promise<Row[]> {
  const rows = new Map<string, Row>();
  for await (const r of records) {
    const key = bucketKey(r.timestamp, by);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        models: [],
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costUSD: 0,
        unpricedModels: [],
      };
      rows.set(key, row);
    }
    row.inputTokens += r.inputTokens;
    row.outputTokens += r.outputTokens;
    row.cacheReadTokens += r.cacheReadTokens;
    row.cacheWriteTokens += r.cacheWrite5mTokens + r.cacheWrite1hTokens;
    if (!row.models.includes(r.model)) row.models.push(r.model);
    const cost = costOf(r, prices);
    if (cost === null) {
      if (!row.unpricedModels.includes(r.model)) row.unpricedModels.push(r.model);
    } else {
      row.costUSD += cost;
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function totalOf(rows: Row[]): Row {
  const total: Row = {
    key: "Total",
    models: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUSD: 0,
    unpricedModels: [],
  };
  for (const r of rows) {
    total.inputTokens += r.inputTokens;
    total.outputTokens += r.outputTokens;
    total.cacheReadTokens += r.cacheReadTokens;
    total.cacheWriteTokens += r.cacheWriteTokens;
    total.costUSD += r.costUSD;
    for (const m of r.models) if (!total.models.includes(m)) total.models.push(m);
    for (const m of r.unpricedModels)
      if (!total.unpricedModels.includes(m)) total.unpricedModels.push(m);
  }
  return total;
}

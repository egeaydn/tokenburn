import type { UsageRecord } from "../providers/types.js";
import { cacheSavingsOf, costOf, defaultPrices, type PriceTable } from "./pricing.js";

export type GroupBy = "day" | "month" | "project" | "model";

export interface Row {
  key: string;
  models: string[];
  /** Tools (providers) that contributed to this row. */
  providers: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Sum of the costs we could price. */
  costUSD: number;
  /** Net USD saved by prompt caching (see cacheSavingsOf). */
  cacheSavedUSD: number;
  /** Models seen in this row that have no known price. */
  unpricedModels: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time bucket key, so "today" matches the user's wall clock. */
export function bucketKey(date: Date, by: "day" | "month"): string {
  const ym = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  return by === "month" ? ym : `${ym}-${pad(date.getDate())}`;
}

/**
 * Makes the same folder compare equal across tools: Claude Code logs `c:\Users\me\repo`,
 * Codex logs `C:\Users\me\repo`.
 */
export function normalizeProject(path: string): string {
  const slashed = path.replaceAll("\\", "/").replace(/(?<=.)\/+$/, "");
  return slashed.replace(/^([a-z]):/, (_, drive: string) => `${drive.toUpperCase()}:`);
}

function keyOf(r: UsageRecord, by: GroupBy): string {
  if (by === "project") return normalizeProject(r.project);
  return by === "model" ? r.model : bucketKey(r.timestamp, by);
}

const emptyRow = (key: string): Row => ({
  key,
  models: [],
  providers: [],
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costUSD: 0,
  cacheSavedUSD: 0,
  unpricedModels: [],
});

const addUnique = (list: string[], value: string) => {
  if (!list.includes(value)) list.push(value);
};

export async function aggregate(
  records: AsyncIterable<UsageRecord> | Iterable<UsageRecord>,
  by: GroupBy,
  prices: PriceTable = defaultPrices,
): Promise<Row[]> {
  const rows = new Map<string, Row>();
  for await (const r of records) {
    const key = keyOf(r, by);
    let row = rows.get(key);
    if (!row) {
      row = emptyRow(key);
      rows.set(key, row);
    }
    row.inputTokens += r.inputTokens;
    row.outputTokens += r.outputTokens;
    row.cacheReadTokens += r.cacheReadTokens;
    row.cacheWriteTokens += r.cacheWrite5mTokens + r.cacheWrite1hTokens;
    addUnique(row.models, r.model);
    addUnique(row.providers, r.provider);
    row.cacheSavedUSD += cacheSavingsOf(r, prices);
    const cost = costOf(r, prices);
    if (cost === null) addUnique(row.unpricedModels, r.model);
    else row.costUSD += cost;
  }
  const sorted = [...rows.values()];
  // Time buckets read chronologically; projects and models read biggest spender first.
  return by === "project" || by === "model"
    ? sorted.sort((a, b) => b.costUSD - a.costUSD || a.key.localeCompare(b.key))
    : sorted.sort((a, b) => a.key.localeCompare(b.key));
}

export function totalOf(rows: Row[]): Row {
  const total = emptyRow("Total");
  for (const r of rows) {
    total.inputTokens += r.inputTokens;
    total.outputTokens += r.outputTokens;
    total.cacheReadTokens += r.cacheReadTokens;
    total.cacheWriteTokens += r.cacheWriteTokens;
    total.costUSD += r.costUSD;
    total.cacheSavedUSD += r.cacheSavedUSD;
    for (const m of r.models) addUnique(total.models, m);
    for (const p of r.providers) addUnique(total.providers, p);
    for (const m of r.unpricedModels) addUnique(total.unpricedModels, m);
  }
  return total;
}

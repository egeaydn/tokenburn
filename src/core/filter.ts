import type { UsageRecord } from "../providers/types.js";

/**
 * Parses `YYYY-MM-DD` or `YYYYMMDD` as a local date. With `endOfDay` the result is the last
 * millisecond of that day, so `--until 2026-10-12` includes the whole 12th.
 */
export function parseDate(input: string, endOfDay = false): Date {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(input.trim());
  if (!m) throw new Error(`Invalid date "${input}". Use YYYY-MM-DD.`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = endOfDay ? new Date(y, mo - 1, d, 23, 59, 59, 999) : new Date(y, mo - 1, d);
  // Reject rollovers such as 2026-02-31.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new Error(`Invalid date "${input}". Use YYYY-MM-DD.`);
  }
  return date;
}

export interface DateRange {
  since?: Date;
  until?: Date;
}

/** `7d` / `2w` -> start of the day that makes the range cover the last N days, today included. */
export function parseLast(input: string, now = new Date()): Date {
  const m = /^(\d+)([dw])$/.exec(input.trim());
  if (!m || Number(m[1]) < 1) throw new Error(`Invalid --last "${input}". Use e.g. 7d or 2w.`);
  const days = Number(m[1]) * (m[2] === "w" ? 7 : 1);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
}

/** Keeps records whose model contains any of `names` (case-insensitive substring). */
export async function* filterByModel(
  records: AsyncIterable<UsageRecord>,
  names: string[],
): AsyncGenerator<UsageRecord> {
  const wanted = names.map((n) => n.toLowerCase());
  for await (const r of records) {
    if (wanted.some((n) => r.model.toLowerCase().includes(n))) yield r;
  }
}

export async function* filterByDate(
  records: AsyncIterable<UsageRecord>,
  { since, until }: DateRange,
): AsyncGenerator<UsageRecord> {
  for await (const r of records) {
    if (since && r.timestamp < since) continue;
    if (until && r.timestamp > until) continue;
    yield r;
  }
}

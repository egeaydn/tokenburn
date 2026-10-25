import pricingData from "../../data/pricing.json" with { type: "json" };
import type { UsageRecord } from "../providers/types.js";

/** USD per 1M tokens. */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

export type PriceTable = Record<string, ModelPrice>;

export const defaultPrices: PriceTable = pricingData.models;

/** Exact match first, then without a trailing `-YYYYMMDD` / `@YYYYMMDD` date suffix. */
export function findPrice(
  model: string,
  prices: PriceTable = defaultPrices,
): ModelPrice | undefined {
  return prices[model] ?? prices[model.replace(/[-@]\d{8}$/, "")];
}

/**
 * Net USD saved by caching versus paying the plain input price for every cached token
 * (cache writes cost extra, so this can be negative). 0 for unpriced models.
 */
export function cacheSavingsOf(record: UsageRecord, prices: PriceTable = defaultPrices): number {
  const p = findPrice(record.model, prices);
  if (!p) return 0;
  return (
    (record.cacheReadTokens * (p.input - p.cacheRead) -
      record.cacheWrite5mTokens * (p.cacheWrite5m - p.input) -
      record.cacheWrite1hTokens * (p.cacheWrite1h - p.input)) /
    1_000_000
  );
}

/** Cost in USD, or null when the model has no known price (never guess). */
export function costOf(record: UsageRecord, prices: PriceTable = defaultPrices): number | null {
  const p = findPrice(record.model, prices);
  if (!p) return null;
  return (
    (record.inputTokens * p.input +
      record.outputTokens * p.output +
      record.cacheReadTokens * p.cacheRead +
      record.cacheWrite5mTokens * p.cacheWrite5m +
      record.cacheWrite1hTokens * p.cacheWrite1h) /
    1_000_000
  );
}

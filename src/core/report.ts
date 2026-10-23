import type { UsageRecord } from "../providers/types.js";
import { bucketKey, normalizeProject } from "./aggregate.js";
import { shortenPaths } from "./paths.js";
import { costOf, defaultPrices, type PriceTable } from "./pricing.js";

export interface Entry {
  name: string;
  /** Tool the entry belongs to (models) or a comma list of tools (projects). */
  provider: string;
  costUSD: number;
  tokens: number;
  /** True when some of this entry's usage could not be priced. */
  partial: boolean;
}

export interface SeriesPoint {
  key: string;
  costUSD: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  /** Cost per tool, so the chart can stack by tool. */
  byProvider: Record<string, number>;
}

export interface ReportData {
  generatedAt: string;
  granularity: "day" | "month";
  range: { from: string; to: string } | null;
  providers: string[];
  totals: {
    costUSD: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    activeDays: number;
    unpricedModels: string[];
  };
  series: SeriesPoint[];
  byProvider: Entry[];
  byModel: Entry[];
  byProject: Entry[];
}

/** Longer spans switch to monthly bars so the chart stays readable. */
const MAX_DAILY_BARS = 400;
const DAY_MS = 86_400_000;

const dayKey = (d: Date) => bucketKey(d, "day");

function nextKey(key: string, by: "day" | "month"): string {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number?];
  return by === "month"
    ? bucketKey(new Date(y, m, 1), "month")
    : bucketKey(new Date(y, m - 1, (d ?? 1) + 1), "day");
}

function top(map: Map<string, Entry>, limit = 12): Entry[] {
  return [...map.values()]
    .sort((a, b) => b.costUSD - a.costUSD || b.tokens - a.tokens)
    .slice(0, limit);
}

export interface ReportOptions {
  prices?: PriceTable;
  /** Replace project names with "Project 1..N" so the report can be shared. */
  anonymize?: boolean;
  now?: Date;
}

export async function buildReport(
  records: AsyncIterable<UsageRecord> | Iterable<UsageRecord>,
  { prices = defaultPrices, anonymize = false, now = new Date() }: ReportOptions = {},
): Promise<ReportData> {
  const days = new Map<string, SeriesPoint>();
  const providers = new Set<string>();
  const unpriced = new Set<string>();
  const byProvider = new Map<string, Entry>();
  const byModel = new Map<string, Entry>();
  const byProject = new Map<string, Entry>();
  const totals = {
    costUSD: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  let first: Date | undefined;
  let last: Date | undefined;

  const bump = (
    map: Map<string, Entry>,
    name: string,
    provider: string,
    cost: number | null,
    tokens: number,
  ) => {
    let e = map.get(name);
    if (!e) {
      e = { name, provider, costUSD: 0, tokens: 0, partial: false };
      map.set(name, e);
    } else if (!e.provider.split(", ").includes(provider)) {
      e.provider += `, ${provider}`;
    }
    e.tokens += tokens;
    if (cost === null) e.partial = true;
    else e.costUSD += cost;
  };

  for await (const r of records) {
    const cost = costOf(r, prices);
    const cache = r.cacheReadTokens + r.cacheWrite5mTokens + r.cacheWrite1hTokens;
    const tokens = r.inputTokens + r.outputTokens + cache;
    if (!first || r.timestamp < first) first = r.timestamp;
    if (!last || r.timestamp > last) last = r.timestamp;
    providers.add(r.provider);
    if (cost === null) unpriced.add(r.model);

    totals.costUSD += cost ?? 0;
    totals.inputTokens += r.inputTokens;
    totals.outputTokens += r.outputTokens;
    totals.cacheReadTokens += r.cacheReadTokens;
    totals.cacheWriteTokens += r.cacheWrite5mTokens + r.cacheWrite1hTokens;

    const key = dayKey(r.timestamp);
    let point = days.get(key);
    if (!point) {
      point = { key, costUSD: 0, inputTokens: 0, outputTokens: 0, cacheTokens: 0, byProvider: {} };
      days.set(key, point);
    }
    point.costUSD += cost ?? 0;
    point.inputTokens += r.inputTokens;
    point.outputTokens += r.outputTokens;
    point.cacheTokens += cache;
    point.byProvider[r.provider] = (point.byProvider[r.provider] ?? 0) + (cost ?? 0);

    bump(byProvider, r.provider, r.provider, cost, tokens);
    bump(byModel, r.model, r.provider, cost, tokens);
    bump(byProject, normalizeProject(r.project), r.provider, cost, tokens);
  }

  const granularity: "day" | "month" =
    first && last && (last.getTime() - first.getTime()) / DAY_MS > MAX_DAILY_BARS ? "month" : "day";

  // Fold days into months when needed, then fill gaps so empty periods show as empty bars.
  const buckets = new Map<string, SeriesPoint>();
  for (const p of [...days.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const key = granularity === "month" ? p.key.slice(0, 7) : p.key;
    const b = buckets.get(key) ?? {
      key,
      costUSD: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheTokens: 0,
      byProvider: {},
    };
    b.costUSD += p.costUSD;
    b.inputTokens += p.inputTokens;
    b.outputTokens += p.outputTokens;
    b.cacheTokens += p.cacheTokens;
    for (const [name, c] of Object.entries(p.byProvider))
      b.byProvider[name] = (b.byProvider[name] ?? 0) + c;
    buckets.set(key, b);
  }
  const series: SeriesPoint[] = [];
  if (first && last) {
    const end = granularity === "month" ? bucketKey(last, "month") : dayKey(last);
    for (
      let k = granularity === "month" ? bucketKey(first, "month") : dayKey(first);
      k <= end;
      k = nextKey(k, granularity)
    ) {
      series.push(
        buckets.get(k) ?? {
          key: k,
          costUSD: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheTokens: 0,
          byProvider: {},
        },
      );
    }
  }

  const projects = top(byProject);
  if (anonymize)
    projects.forEach((p, i) => {
      p.name = `Project ${i + 1}`;
    });
  else {
    const short = shortenPaths(projects.map((p) => p.name));
    for (const p of projects) p.name = short.get(p.name) ?? p.name;
  }

  return {
    generatedAt: now.toISOString(),
    granularity,
    range: first && last ? { from: dayKey(first), to: dayKey(last) } : null,
    providers: [...providers].sort(),
    totals: { ...totals, activeDays: days.size, unpricedModels: [...unpriced].sort() },
    series,
    byProvider: top(byProvider),
    byModel: top(byModel),
    byProject: projects,
  };
}

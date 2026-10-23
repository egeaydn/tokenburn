// Builds a synthetic, deterministic report for the README screenshots (no real data involved).
// Usage: pnpm exec tsx scripts/demo.ts
import { writeFileSync } from "node:fs";
import { aggregate, totalOf } from "../src/core/aggregate.js";
import { shortenPaths } from "../src/core/paths.js";
import { buildReport } from "../src/core/report.js";
import { renderHtml } from "../src/output/html.js";
import { renderTable } from "../src/output/table.js";
import type { UsageRecord } from "../src/providers/types.js";

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(42);
const projects = [
  { path: "/home/dev/code/web-app", weight: 5 },
  { path: "/home/dev/code/api-server", weight: 3 },
  { path: "/home/dev/code/mobile-app", weight: 2 },
  { path: "/home/dev/code/infra", weight: 1 },
  { path: "/home/dev/code/docs-site", weight: 0.6 },
];
const tools = [
  { provider: "claude-code", models: ["claude-sonnet-5-5", "claude-sonnet-5-5", "claude-opus-5-5"] },
  { provider: "codex", models: ["gpt-6-sol", "gpt-5.6-luna", "gpt-6-sol"] },
];

const records: UsageRecord[] = [];
const end = new Date(2026, 9, 23);
for (let d = 59; d >= 0; d--) {
  const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - d, 12);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  if (rand() < (weekend ? 0.55 : 0.1)) continue; // quiet days
  const sessions = 1 + Math.floor(rand() * (weekend ? 2 : 5));
  for (let s = 0; s < sessions; s++) {
    const total = projects.reduce((a, p) => a + p.weight, 0);
    let pick = rand() * total;
    const project = projects.find((p) => (pick -= p.weight) < 0) ?? projects[0];
    const tool = tools[rand() < 0.62 ? 0 : 1];
    if (!project || !tool) continue;
    const model = tool.models[Math.floor(rand() * tool.models.length)] ?? "";
    const calls = 20 + Math.floor(rand() * 90);
    for (let c = 0; c < calls; c += 10) {
      records.push({
        timestamp: new Date(day.getTime() + s * 3_600_000 + c * 1000),
        provider: tool.provider,
        model,
        project: project.path,
        sessionId: `demo-${d}-${s}`,
        inputTokens: Math.floor(rand() * 4000),
        outputTokens: Math.floor(3000 + rand() * 20000),
        cacheReadTokens: Math.floor(400_000 + rand() * 2_400_000),
        cacheWrite5mTokens: tool.provider === "claude-code" ? Math.floor(rand() * 60_000) : 0,
        cacheWrite1hTokens: 0,
      });
    }
  }
}

const data = await buildReport(records, { now: new Date(2026, 9, 23, 12) });
writeFileSync(new URL("../docs/demo-report.html", import.meta.url), renderHtml(data));

const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
const lastDays = records.filter((r) => r.timestamp >= new Date(2026, 9, 19));
const daily = await aggregate(lastDays, "day");
console.log(strip(renderTable(daily, totalOf(daily), { label: "Date", detail: "models" })));
const byProject = await aggregate(records, "project");
const short = shortenPaths(byProject.map((r) => r.key));
console.log(
  strip(
    renderTable(byProject, totalOf(byProject), {
      label: "Project",
      detail: "tools",
      displayKey: (k) => short.get(k) ?? k,
    }),
  ),
);

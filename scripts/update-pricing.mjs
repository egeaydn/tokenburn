// Regenerates data/pricing.json from LiteLLM's public price list.
// Usage: node scripts/update-pricing.mjs
import { writeFileSync } from "node:fs";

const SOURCE = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const PER_MILLION = 1_000_000;
const round = (n) => Math.round(n * PER_MILLION * 1e6) / 1e6;

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Failed to fetch price list: ${res.status}`);
const all = await res.json();

const models = {};
for (const [name, p] of Object.entries(all)) {
  // Provider-native names only (no bedrock/vertex prefixes); extend per provider adapter.
  if (p.litellm_provider !== "anthropic" || !name.startsWith("claude-")) continue;
  if (p.input_cost_per_token == null || p.output_cost_per_token == null) continue;
  const cacheWrite5m = p.cache_creation_input_token_cost ?? p.input_cost_per_token * 1.25;
  models[name] = {
    input: round(p.input_cost_per_token),
    output: round(p.output_cost_per_token),
    cacheRead: round(p.cache_read_input_token_cost ?? p.input_cost_per_token * 0.1),
    cacheWrite5m: round(cacheWrite5m),
    cacheWrite1h: round(p.cache_creation_input_token_cost_above_1hr ?? p.input_cost_per_token * 2),
  };
}

const out = {
  _source: SOURCE,
  _unit: "USD per 1M tokens",
  _updated: new Date().toISOString().slice(0, 10),
  models,
};
writeFileSync(new URL("../data/pricing.json", import.meta.url), `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${Object.keys(models).length} models`);

// Regenerates data/pricing.json from LiteLLM's public price list.
// Usage: node scripts/update-pricing.mjs
import { writeFileSync } from "node:fs";

const SOURCE = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const PER_MILLION = 1_000_000;
const round = (n) => Math.round(n * PER_MILLION * 1e6) / 1e6;

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Failed to fetch price list: ${res.status}`);
const all = await res.json();

// Provider-native names only (no bedrock/azure/vertex prefixes). Extend per provider adapter.
const PROVIDERS = {
  anthropic: { match: /^claude-/, writeFactor: 1.25, write1hFactor: 2 },
  // OpenAI does not bill cache writes separately unless the price list says so.
  openai: { match: /^(gpt-|o\d|codex-)/, writeFactor: 1, write1hFactor: 1 },
};

const models = {};
for (const [name, p] of Object.entries(all)) {
  const cfg = PROVIDERS[p.litellm_provider];
  if (!cfg || !cfg.match.test(name)) continue;
  if (p.input_cost_per_token == null || p.output_cost_per_token == null) continue;
  const input = p.input_cost_per_token;
  const cacheWrite5m = p.cache_creation_input_token_cost ?? input * cfg.writeFactor;
  models[name] = {
    input: round(input),
    output: round(p.output_cost_per_token),
    cacheRead: round(p.cache_read_input_token_cost ?? input * 0.1),
    cacheWrite5m: round(cacheWrite5m),
    cacheWrite1h: round(p.cache_creation_input_token_cost_above_1hr ?? input * cfg.write1hFactor),
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

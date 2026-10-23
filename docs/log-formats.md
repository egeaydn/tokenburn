# Log formats (verified on a real machine, Oct 2026)

## Claude Code — `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl`
- One JSON object per line; `type: "assistant"` lines carry `message.usage` and `message.model`.
- **One API response is split across several lines** (one per content block, same `message.id`
  and identical `usage`). Dedupe by `message.id` or token counts are inflated ~3x
  (640 lines -> 231 unique ids in one session).
- Skip `model: "<synthetic>"`.
- Usage fields: `input_tokens`, `output_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens` (also split in `cache_creation.ephemeral_5m/1h_input_tokens`).
- Each line has `cwd`, `sessionId`, `timestamp` -> project = `cwd` (don't decode the folder name).
- `type: "cost-state"` lines hold Claude Code's own `totalCostUSD` per model: handy as a
  cross-check for our cost calculation.

## Codex CLI — `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl[.zst]`
- **Most files are zstd-compressed** (`.jsonl.zst`, 143 of 158). `zlib.zstd*` only exists in
  Node >= 22.15, so Node 20 needs a JS zstd decoder (e.g. `fzstd`). Also `~/.codex/archived_sessions/`.
- Files can be huge (one uncompressed rollout = 434 MB): always stream, never `readFileSync`.
- `session_meta.payload` -> `cwd`, `cli_version`, `model_provider`. `turn_context.payload` -> `model`, `cwd`.
- Usage: `event_msg` with `payload.type == "token_count"` -> `payload.info.total_token_usage`
  (cumulative) and `last_token_usage`. Consecutive events can repeat the same totals, so summing
  `last_token_usage` over-counts (217.8M vs real 212.9M input). **Use deltas of `total_token_usage`.**
- OpenAI semantics: `input_tokens` INCLUDES `cached_input_tokens`; uncached = input - cached.
  `reasoning_output_tokens` is part of `output_tokens`.

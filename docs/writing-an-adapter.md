# Writing an adapter

An adapter teaches tokenburn to read one tool's local logs. It is one file in `src/providers/` plus one line to register it.

## The contract

```ts
// src/providers/types.ts
export interface Provider {
  name: string;
  read(): AsyncIterable<UsageRecord>;
}
```

`read()` streams one `UsageRecord` per billed model response:

| Field | Meaning |
|---|---|
| `timestamp` | When the response happened |
| `provider` | Your adapter's name, e.g. `"claude-code"` |
| `model` | Model id exactly as the tool logs it (used for the price lookup) |
| `project` | Absolute working directory of the session |
| `sessionId` | Any stable id for the session |
| `inputTokens` | **Uncached** input tokens |
| `outputTokens` | Output tokens, including reasoning/thinking |
| `cacheReadTokens` | Tokens served from the prompt cache |
| `cacheWrite5mTokens` / `cacheWrite1hTokens` | Tokens written to the cache, by TTL (use the 5m field if the tool does not say) |

The buckets must be **disjoint**. Some APIs report cached tokens *inside* `input_tokens` (OpenAI does); subtract them so nothing is counted twice.

## Steps

1. **Look at real logs first.** Open a session file from the tool on your machine and write down what you see. Do not trust documentation or memory; formats drift. Add your findings to [log-formats.md](log-formats.md).
2. **Create `src/providers/<tool>.ts`.** Export a factory such as `export function myToolProvider(dir = defaultDir()): Provider`.
   - Stream files (`readLines` in `lines.ts` handles `.jsonl` and `.jsonl.zst`); log files can be hundreds of MB.
   - Validate each line with `zod` and **skip** anything unexpected instead of throwing. A broken line must never crash a report.
   - Make sure one response is counted once (deduplicate by message id, or use deltas of a running total).
3. **Register it** in `src/providers/index.ts`:
   ```ts
   const factories = {
     "claude-code": () => claudeCodeProvider(),
     codex: () => codexProvider(),
     "my-tool": () => myToolProvider(),
   };
   ```
   That makes `--provider my-tool` work and includes it in every command and in the report.
4. **Prices.** If the tool uses models that are not in `data/pricing.json`, extend `PROVIDERS` in `scripts/update-pricing.mjs` and run `pnpm update-pricing`. Unknown models are shown as "price unknown", never guessed.
5. **Tests.** Put a small, anonymised fixture in `tests/fixtures/<tool>/` and test: normal lines, a broken line, duplicates, and your token arithmetic. If you can, add a test that pins a cost against a number the tool reported itself.
6. **Docs.** Add the tool to the supported-tools table in the README.

## Checklist

- [ ] Streams, never reads a whole file into memory
- [ ] Skips malformed lines
- [ ] Counts each response once
- [ ] Buckets are disjoint (no cached tokens inside `inputTokens`)
- [ ] `project` is a real absolute path, not an encoded folder name
- [ ] Fixture + tests, `pnpm lint && pnpm typecheck && pnpm test` pass

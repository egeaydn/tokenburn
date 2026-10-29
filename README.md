# tokenburn

**See what every repo costs you across Claude Code and Codex CLI, from one command, without any of your data leaving your machine.**

[![CI](https://github.com/egeaydn/tokenburn/actions/workflows/ci.yml/badge.svg)](https://github.com/egeaydn/tokenburn/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tokenburn-ai.svg)](https://www.npmjs.com/package/tokenburn-ai)
[![license](https://img.shields.io/npm/l/tokenburn-ai.svg)](https://github.com/egeaydn/tokenburn/blob/master/LICENSE)

```bash
npx tokenburn-ai
```

tokenburn reads the session logs your AI coding tools already write to disk, merges them into one picture and shows where the tokens (and dollars) go: per day, per month, and, the part most tools skip, **per project**.

![tokenburn report, dark theme](https://raw.githubusercontent.com/egeaydn/tokenburn/master/docs/screenshot-dark.png)

<details>
<summary>Light theme</summary>

![tokenburn report, light theme](https://raw.githubusercontent.com/egeaydn/tokenburn/master/docs/screenshot-light.png)

</details>

> The screenshots use synthetic demo data (`pnpm demo`), not real usage.

## Quick start

```bash
npx tokenburn-ai                  # daily usage and cost (default command)
npx tokenburn-ai today            # or: week, --last 14d
npx tokenburn-ai monthly
npx tokenburn-ai project          # which repo costs what
npx tokenburn-ai model            # which model costs what
npx tokenburn-ai report --open    # shareable HTML report
```

Requires Node 20 or newer. No install, no account, no config.

The npm package is called `tokenburn-ai` (the name `tokenburn` was taken by a lookalike). To get a short permanent command instead of `npx`:

```bash
npm install -g tokenburn-ai
tokenburn project
```

```text
┌────────────┬─────────────┬───────────┬────────────┬───────────────┬─────────────┬─────────┐
│ Project    │ Tools       │     Input │     Output │    Cache Read │ Cache Write │    Cost │
├────────────┼─────────────┼───────────┼────────────┼───────────────┼─────────────┼─────────┤
│ web-app    │ claude-code │   676,040 │  4,179,230 │   541,020,092 │   5,049,944 │ $124.97 │
│            │ codex       │           │            │               │             │         │
├────────────┼─────────────┼───────────┼────────────┼───────────────┼─────────────┼─────────┤
│ api-server │ claude-code │   526,128 │  3,447,751 │   429,687,593 │   5,472,517 │ $124.26 │
│            │ codex       │           │            │               │             │         │
├────────────┼─────────────┼───────────┼────────────┼───────────────┼─────────────┼─────────┤
│ mobile-app │ codex       │   310,194 │  2,080,580 │   269,556,296 │   3,373,566 │  $81.86 │
│            │ claude-code │           │            │               │             │         │
└────────────┴─────────────┴───────────┴────────────┴───────────────┴─────────────┴─────────┘
```

## Supported tools

| Tool | Status | Where it reads from |
|---|---|---|
| Claude Code | Supported | `~/.claude/projects` (or `CLAUDE_CONFIG_DIR`) |
| Codex CLI | Supported | `~/.codex/sessions` and `archived_sessions`, plain and `.zst` (or `CODEX_HOME`) |
| Cursor, GitHub Copilot | Not supported | They do not keep per-request token counts on your machine, so there is nothing honest to show. |

Want another tool? Adding an adapter is one file, see [docs/writing-an-adapter.md](https://github.com/egeaydn/tokenburn/blob/master/docs/writing-an-adapter.md).

## Commands

| Command | What it shows |
|---|---|
| `tokenburn daily` | Usage and cost per day (default) |
| `tokenburn monthly` | Usage and cost per month |
| `tokenburn model` | Usage and cost per model, biggest first |
| `tokenburn today` / `tokenburn week` | Per-day table for today / the last 7 days |
| `tokenburn month` | Per-day table since the 1st of this month (handy with `--budget`) |
| `tokenburn project` | Usage and cost per working directory, biggest first, merged across tools |
| `tokenburn report` | Self-contained HTML report with charts |

Options shared by all of them:

| Option | |
|---|---|
| `--since <date>` / `--until <date>` | `YYYY-MM-DD`, local time, both inclusive |
| `--provider <names>` | `claude-code`, `codex`, or both comma separated |
| `--model <names>` | Only models whose name contains one of these, e.g. `--model opus,sonnet` |
| `--last <n>` | Last N days (`7d`) or weeks (`2w`), today included; instead of `--since`/`--until` |
| `--top <n>` | Show only the first n rows (biggest spenders for `project` and `model`); the total still covers everything (`daily`, `monthly`, `project`, `model`) |
| `--json` | Machine-readable output (`daily`, `monthly`, `project`, `model`) |
| `--csv` | CSV output with a header, usage rows and a total (`daily`, `monthly`, `project`, `model`) |
| `--budget <usd>` | Print a warning to stderr and exit with code 1 if total cost exceeds the amount (`daily`, `monthly`, `project`, `model`) |
| `--sort <cost\|key>` | Row order: biggest cost first, or alphabetical |
| `--watch [seconds]` | Redraw every N seconds (default 5) until Ctrl+C; not combinable with `--json`/`--csv` |

Export a report for a spreadsheet:

```bash
tokenburn project --csv > usage.csv
tokenburn daily --csv --since 2026-10-01 --until 2026-10-31 > october.csv
```

Trim or narrow the output:

```bash
tokenburn model --top 3                 # the three most expensive models
tokenburn project --model opus --last 30d
tokenburn week --provider codex
```

Fail a script or CI job when spending crosses a limit (the warning goes to stderr, so `--json` and `--csv` output stay clean):

```bash
tokenburn monthly --since 2026-10-01 --budget 200 || echo "over budget"
```

`--csv` and `--json` are mutually exclusive. CSV uses the same fields as JSON rows, including
full project paths and unrounded numeric values. The `models`, `providers` and `unpricedModels`
cells contain JSON arrays, so unknown-price models remain visible. Every row also carries
`cacheSavedUSD`, the net saving from prompt caching (see below). Fields containing commas,
quotes or line breaks are quoted, and an empty report still includes the header and a zero total.

`report` also takes `-o, --output <file>`, `--open` and `--anonymize` (replaces project names with `Project 1..N` so you can share a screenshot).

## Privacy

Everything happens on your machine. tokenburn only reads local log files, never sends anything anywhere, and has no telemetry. The HTML report is a single file with inline CSS and JS: no CDN, no fonts, no network requests. It extracts only token counts, model names, timestamps and folder paths; prompt and code content is never stored or written anywhere.

## How cost is calculated

- **It is an API-equivalent price, not your invoice.** Tokens are multiplied by public per-token list prices. If you are on a subscription or a free plan, the number tells you how much usage you got, not what you paid.
- Prices live in [`data/pricing.json`](https://github.com/egeaydn/tokenburn/blob/master/data/pricing.json), generated from [LiteLLM's price list](https://github.com/BerriAI/litellm) by `pnpm update-pricing`. Cache reads and cache writes (5 minute and 1 hour TTL) are priced separately.
- A model without a known price is **never guessed**: it shows up marked with `*` and is left out of the dollar total (its tokens still count).
- Claude Code splits one response over several log lines; tokenburn counts each response once. Codex keeps a running total that can reset; tokenburn counts the change between events. The details, verified against real logs, are in [docs/log-formats.md](https://github.com/egeaydn/tokenburn/blob/master/docs/log-formats.md).

Cross-check: on sessions whose log is complete, the cost matches the totals Claude Code records itself, to the last digit.

## Cache savings

Table output ends with a line like `Cache: 69% of input tokens served from cache, net saving $12.34`.

- The share is cache reads divided by all input-side tokens (uncached input, cache reads and cache writes).
- The saving is what cache reads would have cost at the plain input price, minus what they cost at the cache-read price, minus the extra you pay for cache writes. It can be negative when you write to the cache a lot and rarely read from it.
- Models without a known price contribute nothing to the saving, the same way they are left out of the cost.

## Limitations

- Log formats are not a public API and can change. Parsing is defensive (unknown or broken lines are skipped), but a new release of a tool may need an update here.
- Requests an assistant makes that never reach its session log (for example some background calls) cannot be counted.
- Codex Desktop starts repo-less chats in throwaway folders; they are grouped as `(codex chats)` in the project view.

## Development

```bash
pnpm install
pnpm dev daily          # run from source
pnpm test
pnpm build
```

See [CONTRIBUTING.md](https://github.com/egeaydn/tokenburn/blob/master/CONTRIBUTING.md).

## License

[MIT](https://github.com/egeaydn/tokenburn/blob/master/LICENSE)

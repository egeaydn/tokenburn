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
npx tokenburn-ai monthly
npx tokenburn-ai project          # which repo costs what
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
| `tokenburn project` | Usage and cost per working directory, biggest first, merged across tools |
| `tokenburn report` | Self-contained HTML report with charts |

Options shared by all of them:

| Option | |
|---|---|
| `--since <date>` / `--until <date>` | `YYYY-MM-DD`, local time, both inclusive |
| `--provider <names>` | `claude-code`, `codex`, or both comma separated |
| `--json` | Machine-readable output (`daily`, `monthly`, `project`) |
| `--csv` | CSV output with a header, usage rows and a total (`daily`, `monthly`, `project`) |

Export a report for a spreadsheet:

```bash
tokenburn project --csv > usage.csv
tokenburn daily --csv --since 2026-10-01 --until 2026-10-31 > october.csv
```

`--csv` and `--json` are mutually exclusive. CSV uses the same fields as JSON rows, including
full project paths and unrounded numeric values. The `models`, `providers` and `unpricedModels`
cells contain JSON arrays, so unknown-price models remain visible. Fields containing commas,
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

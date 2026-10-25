# Changelog

## Unreleased

- `--csv` output for `daily`, `monthly` and `project`
- `--budget <usd>`: warn on stderr and exit with code 1 when total cost exceeds the limit
- `model` command, plus `--model` and `--top` filters
- `today` and `week` commands, and `--last 7d` / `--last 2w`
- Cache hit rate and net cache saving under the table; new `cacheSavedUSD` field in JSON and CSV

## 0.1.0

First release.

- Claude Code and Codex CLI adapters (Codex plain and zstd-compressed sessions)
- `daily`, `monthly`, `project` commands with `--since`, `--until`, `--provider`, `--json`
- `report`: self-contained offline HTML report with system, light and dark themes
- API-equivalent cost with separate cache read / 5m write / 1h write pricing; unknown models are flagged, never guessed

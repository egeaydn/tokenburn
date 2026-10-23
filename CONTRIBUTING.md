# Contributing to tokenburn

Thanks for helping. The most valuable contribution is **support for another AI coding tool**, and it is designed to be easy: see [docs/writing-an-adapter.md](docs/writing-an-adapter.md).

## Setup

```bash
git clone https://github.com/egeaydn/tokenburn.git
cd tokenburn
pnpm install
pnpm dev daily      # run from source against your own logs
```

Node 20+ and pnpm 10.

## Before you open a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs the same on Node 20 and 22.

## Ground rules

- **Look at real data before writing a parser.** Log formats change; every claim in `docs/log-formats.md` comes from a real file.
- **Never crash on bad input.** Validate with `zod`, skip what you do not understand.
- **Privacy is the product.** No network calls, no telemetry, no reading prompt or code content. Tests assert that the HTML report makes no network requests.
- **Do not guess prices.** Unknown model means "price unknown".
- Keep fixtures small and anonymised. Never commit real session logs.
- One topic per pull request, branch named `feat/...`, `fix/...` or `chore/...`.
- Commits: short imperative subject (`feat: ...`, `fix: ...`).

## Reporting bugs

Use the bug template. The most useful thing you can attach is the **shape** of a log line that is misread (with prompts and paths removed), plus your tool and its version.

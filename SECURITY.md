# Security Policy

## Supported versions

tokenburn is currently in early development. Security fixes are applied to the latest published version only.

| Version | Supported |
| ------- | --------- |
| latest  | Yes       |
| older   | No        |

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report it privately in one of two ways:

- Use GitHub's **Report a vulnerability** button in the [Security tab](https://github.com/egeaydn/tokenburn/security/advisories/new).
- Email **egeaydinn.dev@gmail.com** with the subject line `tokenburn security`.

Please include:
- A short description of the issue and its impact
- Steps to reproduce, or a proof of concept if you have one
- The tokenburn version and your operating system

## What to expect

- An acknowledgement within about 72 hours
- A status update within about 7 days
- A fix or a clear explanation if we decide it isn't a vulnerability
- Credit in the release notes, unless you prefer to stay anonymous

## Scope

tokenburn runs locally and reads log files that AI coding tools write on your machine. It makes no network requests and sends no telemetry. Reports about the following are especially useful:

- Anything that sends data off the machine
- Unsafe handling of log files, paths, or report output (for example, HTML injection in the `--html` report)
- Supply chain concerns, such as unexpected dependencies or install scripts

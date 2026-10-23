# Security

Context CI is the Context Firewall for AI agents. Reporting a missed
attack shape, a false positive that hurts a real primitive, or a genuine
vulnerability in the tooling all matter. Here's how we'd like to hear from
you, and how we respond.

## TL;DR

| You found | Send it to |
|---|---|
| A missed attack the scanner should catch (false negative) | Open a PR adding a labeled sample + a reproducer |
| A real, benign primitive being flagged (false positive) | Open a PR with a minimal reproducer |
| A vulnerability in the tooling itself (verify kernel, CLI, MCP server, Action) | Email `security@primitivehub.ai` (PGP on request) — private until fixed |
| Not sure | Email `security@primitivehub.ai` and we'll triage |

## Scope

In scope: `@primitivehub/verify`, `@primitivehub/phub`, the
`@primitivehub/mcp-server`, and the `phub-scan` GitHub Action published
from this repository.

A finding is most useful when it's **reproducible**: the smallest input
that produces the wrong verdict, the command you ran, and what you
expected. Deterministic detectors mean a good reproducer is a regression
test we can keep forever.

## Coordinated disclosure

For tooling vulnerabilities, please give us a reasonable window to ship a
fix before public disclosure. Email `security@primitivehub.ai`; we
acknowledge within a few business days and keep you updated through the
fix. We credit reporters who want credit.

## What we will not do

We do not execute the content you submit. The scanner reads bytes; a
sample you send to demonstrate an attack is analyzed statically, never
run. Don't send live secrets — if a reproducer needs a credential shape,
use an obvious dummy.

## More

Methodology, the Context CI Top 10 taxonomy, and the false-positive /
false-negative resolution process are documented at
<https://primitivehub.ai>.

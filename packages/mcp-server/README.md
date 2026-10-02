# @primitivehub/mcp-server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

**Model Context Protocol server exposing PrimitiveHub verification +
scanning to AI agents** (Claude Code, Cursor, Aider, etc.). Pure
transport over [`@primitivehub/verify`](../verify/) and
[`@primitivehub/phub`](../phub/) — **zero custom trust logic** per
Gate G-D acceptance + [ADR-0031](../../docs/decisions/0031-mcp-server-as-transport.md).

## What it does

Lets an AI agent ask, mid-task:

- "Is this Trust Bundle valid?" → `verify_bundle`
- "Does this text trip Context CI Top 10?" → `scan_text`
- "What context primitives are in this workspace, and which are
  flagged?" → `audit_workspace`
- "Has any context primitive in this workspace changed since the
  operator last sealed it?" → `check_lock`

Every tool is a pure wrapper. If the verify library changes its
behavior, this server inherits it. If the scanner roster expands
(T3/T4/T6..T10), this server surfaces it. There is one authoritative
trust implementation; this package is the wire format.

## Install

Per [ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md)
publishing is gated to the project launch event. Post-launch:

```bash
# Add to Claude Code (one line):
claude mcp add primitivehub --command "npx @primitivehub/mcp-server"

# Or globally:
pnpm add -g @primitivehub/mcp-server
primitivehub-mcp   # speaks MCP over stdio
```

Requires Node ≥ 20.

## Quick-start configurations

### Claude Code

`~/.claude.json` (or `.claude.json` in the project):

```json
{
  "mcpServers": {
    "primitivehub": {
      "command": "npx",
      "args": ["@primitivehub/mcp-server"]
    }
  }
}
```

Then `claude mcp list` shows `primitivehub` with four tools.

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "primitivehub": {
      "command": "npx",
      "args": ["-y", "@primitivehub/mcp-server"]
    }
  }
}
```

### Aider

`~/.aider.conf.yml`:

```yaml
# MCP support landed in Aider 0.85+
mcp-servers:
  primitivehub:
    command: npx
    args: ["@primitivehub/mcp-server"]
```

See [`examples/`](./examples/) for complete host configurations.

## Tools

### `verify_bundle`

Verify a [Trust Contract v0.1](../../docs/trust-contract-v0.1.md)
bundle. Wraps `@primitivehub/verify`'s `verifyBundle`. Steps 3-6
stubbed in v0.1 (see verify README).

**Arguments:**

| Field | Type | Required | Default |
|---|---|---|---|
| `bundle` | string \| object | yes | — |
| `level` | `"structural"` \| `"policy"` \| `"full"` | no | `"policy"` |
| `strict` | boolean | no | `false` |
| `allow_fail_for` | string[] | no | `[]` |

### `scan_text`

Run the v0.1 detector roster (T1/T2/T5) against text. Wraps phub's
`runScan`.

**Arguments:**

| Field | Type | Required | Default |
|---|---|---|---|
| `content` | string | yes | — |
| `filename` | string | no | `"<inline>"` |
| `detectors` | string[] | no | all |
| `strict` | boolean | no | `false` |
| `policy_path` | string | no | auto-discover |
| `allow_fail` | string[] | no | `[]` |

### `audit_workspace`

Active surface — discovers + classifies + scans every agent-context
artifact under a root. Wraps phub's `runAudit` per [ADR-0025](../../docs/decisions/0025-active-posture-and-phub-audit.md).

**Arguments:**

| Field | Type | Required | Default |
|---|---|---|---|
| `root` | string | no | `process.cwd()` |
| `max_files` | number | no | `10000` |
| `max_depth` | number | no | `16` |
| `strict` | boolean | no | `false` |
| `detectors` | string[] | no | all |
| `policy_path` | string | no | auto-discover |
| `allow_fail` | string[] | no | `[]` |

### `check_lock`

Compares the workspace against `.primitivehub/phub.lock` per
[ADR-0026](../../docs/decisions/0026-phub-lock-format-and-drift-detection.md)
and reports drift (added / modified / removed / reclassified).

**Arguments:**

| Field | Type | Required | Default |
|---|---|---|---|
| `root` | string | no | `process.cwd()` |
| `lock_path` | string | no | `./.primitivehub/phub.lock` |
| `policy_path` | string | no | auto-discover |
| `max_files` | number | no | `10000` |
| `max_depth` | number | no | `16` |

## Design discipline

Per [ADR-0031](../../docs/decisions/0031-mcp-server-as-transport.md)
this package is a transport layer with three load-bearing rules:

1. **Zero custom trust logic.** Every tool delegates to a primitive
   that already exists (verify / phub). If a behavioral question
   doesn't have an answer in the delegated primitive, the answer is
   "we don't ship that tool yet" — not "we'll re-implement it here."
2. **Schema-stable tool surface.** Adding a tool is additive (no
   breaking change). Renaming or removing a tool requires a SemVer
   major bump on this package.
3. **No state retention.** Every tool call is stateless. The server
   does not cache, queue, or remember invocations. The agent's
   conversation is the only state that matters.

The MCP runtime gate `verify_before_load` (planned [ADR-0029](../../docs/decisions/0026-phub-lock-format-and-drift-detection.md))
is a composite of `check_lock` + `verify_bundle` applied at the
agent's read time. v0.1 of this package exposes the primitives; the
composite gate ships when ADR-0029 lands.

## Programmatic embedding

For tests / alternative transports (SSE, HTTP in v0.2+):

```ts
import { buildServer } from "@primitivehub/mcp-server"

const server = buildServer()
// Connect over an SDK transport of your choice:
//   StdioServerTransport, InMemoryTransport, etc.
```

## Versioning + publishing

Tracks Trust Contract spec version + Context CI Top 10 version
(both v0.1 in this release).

Per [ADR-0022](../../docs/decisions/0022-publishing-deferred-to-launch.md)
publishing is gated to launch via the same three-lock model as
`@primitivehub/verify` and `@primitivehub/phub`.

## License

MIT. See [LICENSE](./LICENSE).

## References

- [ADR-0031 — `@primitivehub/mcp-server` as the MCP transport layer](../../docs/decisions/0031-mcp-server-as-transport.md)
- [ADR-0023 — `phub` CLI + detector parity](../../docs/decisions/0023-phub-cli-and-detector-parity.md)
- [ADR-0025 — Active posture + `phub audit`](../../docs/decisions/0025-active-posture-and-phub-audit.md)
- [ADR-0026 — `phub.lock` format + drift detection](../../docs/decisions/0026-phub-lock-format-and-drift-detection.md)
- [ADR-0018 — Context Policy Language v0.1](../../docs/decisions/0018-context-policy-language.md)
- [Model Context Protocol](https://modelcontextprotocol.io/) — the protocol spec

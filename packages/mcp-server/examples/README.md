# Worked examples — host configurations

Each file in this directory is a minimum-viable host config that
registers `@primitivehub/mcp-server` so the host's agent can call
`verify_bundle`, `scan_text`, `audit_workspace`, and `check_lock`.

Per [ADR-0031](../../../docs/decisions/0031-mcp-server-as-transport.md)
all three are required to satisfy Gate G-D acceptance.

| Host | File | Where it lives |
|---|---|---|
| Claude Code | [`claude-code.json`](./claude-code.json) | `~/.claude.json` or project `.claude.json` |
| Cursor | [`cursor-mcp.json`](./cursor-mcp.json) | `.cursor/mcp.json` (per project) |
| Aider | [`aider.conf.yml`](./aider.conf.yml) | `~/.aider.conf.yml` (Aider 0.85+) |

Each config assumes `@primitivehub/mcp-server` is on npm. To run against a
local build from source instead, point `command` at the local binary:

```diff
- "command": "npx",
- "args": ["@primitivehub/mcp-server"]
+ "command": "node",
+ "args": ["/abs/path/to/packages/mcp-server/bin/primitivehub-mcp.js"]
```

After the launch publish the `npx` form just works.

## Quick verify

Once the config is in place, each host's MCP-list command should
show `primitivehub` with four visible tools:

- Claude Code: `claude mcp list`
- Cursor: Settings → MCP servers panel
- Aider: `/mcp` slash command in-session

## Smoke test from the command line

Without any host, you can speak MCP directly to the binary:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | npx @primitivehub/mcp-server
```

Expected: JSON-RPC response with four tools in `result.tools`.

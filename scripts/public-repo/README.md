# Context CI — by PrimitiveHub

**The Context Firewall for AI agents.** Verify, scan, and gate every piece
of context an AI agent loads — instructions, skills, rules, MCP configs,
`AGENTS.md`, `CLAUDE.md` — against the [Context CI Top 10][top10] supply-chain
attack taxonomy.

Open source, MIT-licensed, zero-telemetry. Built by [PrimitiveHub AI / CyberOrca Labs][orca].

[![verify](https://img.shields.io/npm/v/%40primitivehub%2Fverify?label=%40primitivehub%2Fverify)](https://www.npmjs.com/package/@primitivehub/verify)
[![phub](https://img.shields.io/npm/v/%40primitivehub%2Fphub?label=%40primitivehub%2Fphub)](https://www.npmjs.com/package/@primitivehub/phub)
[![mcp-server](https://img.shields.io/npm/v/%40primitivehub%2Fmcp-server?label=%40primitivehub%2Fmcp-server)](https://www.npmjs.com/package/@primitivehub/mcp-server)

---

## Download

Everything ships on npm. No account, no sign-up.

### `phub` — the CLI (start here)

Scan a repository for agent-context attacks in one command:

```bash
npx @primitivehub/phub audit
```

Or install it:

```bash
npm i -g @primitivehub/phub
phub audit            # discover + classify + scan every context artifact
phub scan AGENTS.md   # scan one file
phub verify <bundle>  # verify a Trust Bundle, offline
```

### `@primitivehub/verify` — the verifier kernel

Embed Trust Bundle verification in your own tool. Zero runtime dependencies,
< 20 KB, verifies offline against bundled Sigstore trust roots.

```bash
npm i @primitivehub/verify
```

```ts
import { verifyBundle } from "@primitivehub/verify";

const result = await verifyBundle(bundleJson);
if (!result.ok) throw new Error(`untrusted: ${result.reason}`);
```

### `@primitivehub/mcp-server` — runtime gate for agents

Give Claude Code, Cursor, Aider, or any MCP agent a `verify_before_load`
tool that refuses unattested context by default.

```bash
claude mcp add primitivehub -- npx -y @primitivehub/mcp-server
```

### Context CI GitHub Action — gate it in CI

Fail the build when a PR introduces a Top 10 finding; SARIF lands in the
Security tab.

```yaml
# .github/workflows/context-ci.yml
- uses: PrimitiveHub-AI/context-ci/actions/phub-scan@v0.1.0
  with:
    paths: "AGENTS.md CLAUDE.md **/SKILL.md .cursor/rules/** **/mcp.json"
```

---

## What it catches

The [Context CI Top 10][top10] — the supply-chain attack surface that lives
in the markdown and configs agents load directly into context: prompt
injection, Unicode steganography, unsafe shell-install instructions, and
seven more. Every detector is deterministic and reproducible — same input,
same verdict, no ML, no vibes score.

## Repository layout

| Path | Ships as |
|---|---|
| [`packages/verify/`](packages/verify) | npm `@primitivehub/verify` — verifier kernel |
| [`packages/phub/`](packages/phub) | npm `@primitivehub/phub` — CLI (`phub`) |
| [`packages/mcp-server/`](packages/mcp-server) | npm `@primitivehub/mcp-server` — MCP runtime gate |
| [`actions/phub-scan/`](actions/phub-scan) | GitHub Action — CI gating + SARIF |
| [`examples/`](examples) | Embedding + MCP integration samples |

## Build from source

Packages are independent (each builds + tests on its own). Build order is
`verify` → `phub` → `mcp-server` (later packages consume earlier ones).

```bash
cd packages/verify && pnpm install && pnpm build && pnpm test
```

## Security

Found a missed attack, a false positive on a real primitive, or a
vulnerability? See [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).

[top10]: https://primitivehub.ai/top-10
[orca]: https://primitivehub.ai

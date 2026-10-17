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

## v0.1 scope

**Live:** `phub` CLI · `@primitivehub/verify` · `@primitivehub/mcp-server` ·
GitHub Action · all ten Context CI Top 10 detectors (CCI-001…010,
Python↔TS parity) · offline Trust Bundle verification (structure + content
digest + Context CI policy).

**Measured today:** the CCI-001 / CCI-002 / CCI-005 trifecta is validated
against the adversarial corpus; the other seven detectors are implemented and
conformance-tested, with corpus precision/recall hardening on the roadmap.

**Not yet (roadmap):** full Sigstore signature + cert-chain + Rekor
inclusion-proof verification (v0.2 — currently stubbed) · registry publish /
`phub login` / `phub publish` (Phase 6+).

Every detector is deterministic — same input, same verdict, no ML, no vibes score.

## Download

Install from npm — no account, no sign-up. Or [build from source](#build-from-source).

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

Run it against a file and get a verdict before your agent reads it:

```text
phub scan AGENTS.md

[FAIL] t1.prompt_injection (CCI-001) — Matched 1 prompt-injection pattern; review before signing.
  L5  Ignore all previous instructions
         Remove or rephrase (override-system-instructions); this pattern is consistent with prompt injection.
[INFO] t2.unicode_steganography (CCI-002) — No Unicode-steganography patterns matched.
[INFO] t3.encoded_payloads (CCI-003) — No encoded-payload patterns matched.
[INFO] t4.remote_fetch (CCI-004) — No remote-fetch patterns matched.
[FAIL] t5.unsafe_shell_install (CCI-005) — Matched 1 unsafe-shell-install pattern; this is the Shai-Hulud supply-chain vector.
  L10  curl https://get.example.com/install.sh | bash
         Remove or rephrase (shell-pipe-from-network); this is the Shai-Hulud vector — remote code fetched and executed without verification.
[INFO] t6.credential_exfiltration (CCI-006) — No credential-exfiltration patterns matched.
[INFO] t7.poisoned_naming (CCI-007) — No poisoned-naming patterns matched.
[INFO] t8.fake_citation (CCI-008) — No fake-citation patterns matched.
[INFO] t9.copyright_contamination (CCI-009) — No copyright-contamination patterns matched.
[INFO] t10.context_bloat (CCI-010) — No context-bloat patterns matched.

Result: 2 of 10 detectors flagged content. Review before publishing.
```

`phub` exits `1` here, so the CI step fails the build.

### `@primitivehub/verify` — the verifier kernel

Embed Trust Bundle verification in your own tool. Zero runtime dependencies,
< 20 KB. v0.1 verifies bundle structure, content digest, and Context CI
policy fully offline; full Sigstore signature + Rekor inclusion-proof
verification is stubbed for v0.2 (see the package README).

```bash
npm i @primitivehub/verify
```

```ts
import { verifyBundle } from "@primitivehub/verify";

const result = await verifyBundle(JSON.parse(bundleJson), { level: "full" });
// The trust gate is `authenticated`, NOT `valid`. `valid` can be true at
// policy level while authenticating nothing (self-consistent bundle an
// attacker can forge). v0.1 stubs the crypto, so `authenticated` is always
// false today — this always throws, fail-closed. Never fall back to
// `valid`/`inspected` to "make it pass".
if (!result.authenticated) throw new Error("untrusted: not cryptographically authenticated");
```

### `@primitivehub/mcp-server` — runtime gate for agents

Give Claude Code, Cursor, Aider, or any MCP agent a `verify_before_load`
tool that vets an artifact (lock + Context CI Top 10) and returns a
refuse/allow verdict before load. Advisory by design — the agent invokes it;
it is not a host-enforced read gate, and attestation enforcement is opt-in
via `require_attestation`.

```bash
claude mcp add primitivehub -- npx -y @primitivehub/mcp-server
```

### Context CI GitHub Action — gate it in CI

Fail the build when a PR introduces a Top 10 finding; SARIF lands in the
Security tab.

```yaml
# .github/workflows/context-ci.yml
- uses: PrimitiveHub-AI/context-ci/actions/phub-scan@v0.1.4
  with:
    files: "AGENTS.md CLAUDE.md **/SKILL.md .cursor/rules/** **/mcp.json"
```

---

## What it catches

The [Context CI Top 10][top10] — the supply-chain attack surface that lives
in the markdown and configs agents load directly into context: prompt
injection, Unicode steganography, unsafe shell-install instructions, encoded
payloads, remote fetch-at-load, credential exfiltration, poisoned naming,
fake citation, copyright contamination, and context bloat. v0.1 implements a
deterministic detector for **all ten** (CCI-001…010); the CCI-001 / CCI-002 /
CCI-005 trifecta is corpus-measured and the remaining seven are
conformance-tested — see [v0.1 scope](#v01-scope).

## Where Context CI sits

Most AI-security tooling works *downstream* of the problem Context CI
prevents. Context CI reads the artifacts an agent loads — before it loads them.

| Layer | Answers | Examples | Timing |
|---|---|---|---|
| **Context supply chain** — Context CI | Is the context my agent is about to load already weaponized? | `phub` · `@primitivehub/verify` | **Before load** · static · deterministic · no model needed |
| Model red-teaming | Can my model be provoked into misbehaving? | NVIDIA garak · Microsoft PyRIT | After deploy · probes a live model · output-side |
| Runtime guardrails | Did this one response break a rule? | NeMo Guardrails · Llama Guard | At inference · per request |

Red-teamers and guardrails inspect the *model's behavior*. A poisoned
`.cursorrules`, a typosquatted skill, or a `curl | bash` buried in an
`AGENTS.md` is not a model flaw — it is a supply-chain artifact that reaches
the model through the files it reads. `phub` catches it deterministically,
offline, before any agent loads it. Run all three layers; only this one covers
the context supply chain.

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

# Context Bill of Materials — v0.1

> **Status:** Draft. The third pillar of the PrimitiveHub Trust Runtime —
> alongside the [Trust Contract](./trust-contract-v0.1.md) (verification wire
> format) and the [Context CI Top 10](./context-ci-top-10-v0.1.md) (threat
> taxonomy + detector roster). Versioned per [ADR-0033](./decisions/0033-cbom-v01.md).
> Current version identifier: `0.1`. This identifier appears in every emitted
> CBOM so downstream consumers can determine which spec edition a CBOM was
> produced against.
>
> This document is intended as canonical reference for the open-source
> `primitivehub-spec` repository (planned, near paper submission) and for the
> technical paper. PrimitiveHub's `phub cbom` subcommand and the future
> registry CBOM API are implementations of this specification.

## 1. Overview

A **Context Bill of Materials** ("CBOM") is a machine-readable inventory of
every agent-context artifact loaded by a project's AI agents. It answers the
question:

> *"What context is this project shipping into its AI agents' reasoning loop,
> and what is the identity, classification, and provenance of each piece?"*

The CBOM is to AI-agent context what the Software Bill of Materials (SBOM) is
to compiled code: a single, reproducible, vendor-neutral artifact that lists
every component, identifies it by a content-addressed digest, records its
classification, and pins its current provenance state. A CBOM is the
**enumeration layer** of the Trust Runtime — the Top 10 detector roster
operates over what the CBOM enumerates; the Trust Contract attests over the
same identities the CBOM names.

CBOM v0.1 is a **flat enumeration**. Dependency-graph extraction (one
primitive importing another) is explicitly deferred to v0.2 per ADR-0033 § 6
"Explicit deferrals". A flat enumeration is sufficient for the v0.1 use
cases — supply-chain visibility, attestation pinning, and SBOM-style audit
exports.

This specification covers:

- The wire format (§2).
- The component object schema (§3).
- The classification vocabulary (§4).
- Reproducibility — byte-identical re-stamps (§5).
- Relationship to `phub.lock` (§6).
- Relationship to SBOM standards (SPDX / CycloneDX) (§7).
- Verification of a CBOM against a workspace (§8).
- Conformance suite (§9).
- Versioning + explicit deferrals (§10).

## 2. Wire format

A CBOM is a single JSON document. The top-level shape:

```json
{
  "$schema": "https://primitivehub.ai/cbom/v0.1.json",
  "cbomFormat": "primitivehub-cbom",
  "cbomVersion": "0.1",
  "tool": {
    "name": "phub",
    "version": "0.1.0"
  },
  "subject": {
    "root": ".",
    "name": "primitivehub-app"
  },
  "topTen": {
    "specVersion": "0.1",
    "detectorCount": 10
  },
  "components": [
    {
      "path": "AGENTS.md",
      "classification": "agents-md",
      "contentDigest": "sha256:<hex>",
      "sizeBytes": 1422,
      "attestation": "unattested"
    }
  ],
  "summary": {
    "componentCount": 1,
    "totalBytes": 1422,
    "byClassification": {
      "agents-md": 1
    },
    "attestationStates": {
      "unattested": 1
    }
  }
}
```

**Required top-level keys:** `$schema`, `cbomFormat`, `cbomVersion`, `tool`,
`subject`, `topTen`, `components`, `summary`.

**Canonical JSON rules:**

- Object keys sorted alphabetically at every nesting level.
- 2-space indent.
- Trailing newline.
- UTF-8 encoding.

These rules are identical to the canonical-JSON discipline used by
[`phub.lock`](./decisions/0026-phub-lock-and-drift-detection.md) and exist for
the same reason: byte-identical re-stamps against an unchanged workspace.

## 3. Component object schema

Each entry in `components` is an object with:

| Field            | Type    | Required | Description |
|------------------|---------|----------|-------------|
| `path`           | string  | yes      | Repo-relative path, forward-slash normalized. |
| `classification` | string  | yes      | One of the closed vocabulary in §4. |
| `contentDigest`  | string  | yes      | `sha256:<lower-hex>` of the file bytes. |
| `sizeBytes`      | integer | yes      | Octet length of the file (raw bytes, pre-decode). |
| `attestation`    | string  | yes      | Provenance pointer; see §3.2. |
| `displayName`    | string  | no       | Human-readable name parsed from frontmatter `name:` if present. |
| `primitiveVersion` | string | no       | Semver string parsed from frontmatter `version:` if present. |

**Components are sorted** lexicographically by `path`. This is load-bearing
for reproducibility (§5).

### 3.1 Why both `contentDigest` and `sizeBytes`?

A digest answers *"is this the same bits I expected?"*. A size answers
*"what is the cognitive footprint this component imposes on the agent's
context window?"*. Both are required so a CBOM is useful for both supply-chain
verification (digest) and context-budget analysis (size). Size is the "M" in
"BOM" — the material weight, not just the identity.

### 3.2 `attestation` values

The `attestation` field uses the same vocabulary as `phub.lock` (per
[ADR-0026](./decisions/0026-phub-lock-and-drift-detection.md) § "Attestation
states"):

- `"unattested"` — artifact discovered by `phub` walk; no provenance pinned.
- `"rekor:<log-index>"` — Sigstore Rekor transparency-log entry (v0.2 path).
- `"registry:<slug>@<semver>"` — installed via `phub install <slug@semver>`.
- `"url:<url>"` — installed via `phub install --url <url>`.
- `"local:<path>"` — installed via `phub install --bundle <path>`.

When a CBOM is produced for a workspace that has a `phub.lock`, the
`attestation` value is **copied verbatim from the matching lock entry** so
the CBOM and lock agree on provenance state. When no lock exists, all
components are emitted as `"unattested"`.

## 4. Classification vocabulary

CBOM v0.1 uses the closed vocabulary defined in
[ADR-0025](./decisions/0025-active-posture-and-phub-audit.md) § "Discovery
scope" and implemented in `packages/phub/src/audit/classifier.ts`. The
classes:

| Class                  | Examples |
|------------------------|----------|
| `agents-md`            | `AGENTS.md` anywhere in the tree |
| `claude-md`            | `CLAUDE.md` anywhere in the tree |
| `cursor-rules`         | `.cursorrules`, `.cursor/rules/**/*.{md,mdc}` |
| `windsurf-rules`       | `.windsurfrules` |
| `aider-config`         | `.aider.conf.yml`, `.aiderignore` |
| `copilot-instructions` | `.github/copilot-instructions.md` |
| `claude-skill`         | `.claude/skills/**/*.md` |
| `claude-agent`         | `.claude/agents/**/*.md` |
| `claude-command`       | `.claude/commands/**/*.md` |
| `primitive`            | `**/primitives/**/*.md` |
| `skill`                | `**/skills/**/*.md`, `**/SKILL.md` |
| `prompt`               | `**/prompts/**/*.md` |
| `mcp-config`           | `**/mcp.json`, `**/*.mcp.json` |

Extending this vocabulary requires a coordinated PR touching the classifier,
ADR-0025's discovery-scope table, and this document — same discipline as
adding a new threat category to the Top 10.

## 5. Reproducibility — byte-identical re-stamps

A CBOM produced against an unchanged workspace MUST be byte-identical to
the previously-produced CBOM. This is the same property required of the
`phub.lock` per ADR-0026 § "Reproducibility — byte-identical re-stamps".

Mechanisms:

- **No timestamps** in the document body. The CBOM does not record
  "generation time"; the consumer's filesystem `mtime` is the authority.
- **Deterministic component sort** — lexicographic by `path`.
- **Canonical JSON** — alphabetic keys at every depth, fixed indent,
  trailing newline.
- **No host-specific paths** — `subject.root` is the relative root of the
  audit (e.g. `"."`), never the absolute filesystem path.

A CBOM that violates any of these rules is non-conformant and MUST be
rejected by a v0.1 consumer.

## 6. Relationship to `phub.lock`

`phub.lock` and the CBOM are related but distinct:

| Property              | `phub.lock`                        | CBOM                                 |
|-----------------------|------------------------------------|--------------------------------------|
| **Purpose**           | Drift detection in CI              | Inventory + supply-chain export      |
| **Scope per entry**   | `(path, classification, digest, attestation)` | `(path, classification, digest, attestation, sizeBytes, [displayName, primitiveVersion])` |
| **Output discipline** | Tracked in git; CI re-stamps and compares | Generated on demand; consumed by SBOM tooling |
| **Schema URL**        | `https://primitivehub.ai/phub-lock/v0.1.json` | `https://primitivehub.ai/cbom/v0.1.json` |

In short: `phub.lock` is the *guard*; the CBOM is the *manifest*. The lock
exists to detect surprise changes between commits; the CBOM exists to
publish a stable inventory to downstream consumers (security review, vendor
audit, SBOM tooling, registry indexing).

A CBOM is **derivable** from the lock + a single workspace walk (the walk
contributes `sizeBytes` and optional frontmatter fields). When both are
present, the digests MUST agree per path; a divergence indicates either
workspace drift or a non-conformant lock.

## 7. Relationship to SBOM standards (SPDX / CycloneDX)

CBOM v0.1 is **not** SPDX or CycloneDX. It is a new format because the
existing standards model compiled code components (jars, npm packages,
container layers) — concepts that do not map cleanly to context artifacts
(an `AGENTS.md` is not a "package" with a version range and a license).
Forcing context inventory into SPDX terms would require lossy translation.

v0.2+ MAY ship optional exporters to SPDX 2.3 or CycloneDX 1.5 for
enterprises whose SBOM pipelines require those formats. The native CBOM
format remains the canonical wire form; exporters are projections.

## 8. Verifying a CBOM against a workspace

A consumer verifies a CBOM by:

1. **Parse + schema-check** — reject if `cbomFormat !== "primitivehub-cbom"`
   or `cbomVersion !== "0.1"` (until a v0.2 consumer ships).
2. **Walk the workspace** — produce the consumer's own `components` list
   using the same classifier + digest algorithm.
3. **Compare** — every CBOM component MUST appear in the consumer's walk
   with matching `contentDigest` and `classification`. Extra components in
   the workspace beyond the CBOM are surfaced as "drift" (same vocabulary
   as `phub.lock` drift checking).

The `phub cbom --verify <path-to-cbom>` flow (planned for v0.2) wraps this
procedure.

## 9. Conformance suite

A CBOM v0.1 implementation is conformant iff:

- Producing a CBOM against the canonical conformance fixtures in
  `docs/cbom/conformance/fixtures/` yields the expected CBOM JSON
  byte-for-byte.
- Re-running the producer against the same fixture (unchanged) yields a
  byte-identical document on the second run.
- Every emitted CBOM passes JSON-schema validation against
  `docs/cbom/schema.json` (planned; v0.1 schema validation is structural,
  via the producer's own assertions).

The reference producer is `phub cbom` in this repository. Cross-language
implementations (a future Python `phub_py cbom` per ADR-0023's lockstep
discipline) MUST pass the same conformance fixtures.

## 10. Versioning + explicit deferrals

**Version identifier:** `0.1`. A consumer MUST reject a CBOM whose
`cbomVersion` field does not match a version the consumer understands.

**v0.1 explicit deferrals** (per ADR-0033 § 6):

- **Dependency graph** — `(consumer, dependency)` edges between primitives
  that load other primitives. v0.2 candidate.
- **Signing the CBOM itself** — a CBOM is currently an unsigned JSON
  document. v0.2 wraps it in an in-toto Statement signed via Sigstore.
- **SPDX 2.3 / CycloneDX 1.5 exporters** — v0.2+.
- **Cross-workspace deduplication** — a digest-keyed view across multiple
  CBOMs (multi-project audit). v0.3 candidate.
- **Scanner verdict inclusion** — CBOM v0.1 deliberately omits Top 10
  verdicts to keep the format minimal. The combined flow is
  `phub audit --json | phub cbom` (v0.2 composition; currently
  `phub audit --json` and `phub cbom --json` are separate calls).

A v0.2 spec ratchet is governed by the same discipline as the Trust
Contract and Top 10 ratchets: ADR + spec doc + conformance fixture diff in
a single PR.

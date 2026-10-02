# Glossary — abbreviations & terms

> Quick decoder for the acronyms that show up in commit messages, ADRs,
> evaluation tables, and ledger entries across this repo. Where a term has
> a canonical home, the authoritative doc is linked — this file is an index,
> not a redefinition. Cryptographic vocabulary is **locked** in
> [`CLAUDE.md`](../CLAUDE.md) and reproduced here for convenience.

## Core project terms

| Term | Meaning |
|---|---|
| **Context CI** | The pipeline that statically scans agent-context artifacts (primitives, skills, MCP configs) for supply-chain threats. The project's core defense layer. |
| **CCI** | A **Context CI** threat ID. The taxonomy is the **Context CI Top 10**, numbered `CCI-001`…`CCI-010`. Each `CCI-NNN` maps 1:1 to a `TN` threat category. See [`docs/threat-model.md`](./threat-model.md). |
| **T1…T10** | The 10 supply-chain attack **categories** in the threat model. Same things as `CCI-001..CCI-010`; the `TN` form is used in scanner code (e.g. `t5-unsafe-shell-install`). |
| **Top 10** | Shorthand for the **Context CI Top 10** threat taxonomy (the `CCI` / `T` list). |
| **CBOM** | **Context Bill of Materials** — the machine-readable inventory artifact for agent-context. Third pillar of the Trust Runtime. [`docs/cbom-v0.1.md`](./cbom-v0.1.md). |
| **phub** | The project CLI / package (`@primitivehub/phub`): `audit`, `scan`, `watch`, `install`, `cbom`. |
| **AV** | **Antivirus** — the product-family analogy: "agent-context AV plus registry." Maps scanner / signature DB / allowlist / FP portal / on-access guard, etc. ([ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md)). |
| **Primitive** | A unit of AI context (skill, prompt, MCP config…) — the thing the registry stores and Context CI scans. |

## Detection & corpus

| Term | Meaning |
|---|---|
| **FP** / **FP-NNN** | **False Positive** + its append-only ledger entry. [`docs/false-positive-resolution.md`](./false-positive-resolution.md). |
| **FN** / **FN-NNN** | **False Negative** + its append-only ledger entry. [`docs/false-negative-resolution.md`](./false-negative-resolution.md). |
| **TP / TN / FP / FN** | The confusion-matrix cells: **True Positive / True Negative / False Positive / False Negative**. |
| **WAI** | **Working As Intended** — the "domain WAI" resolution path for a flagged-but-legitimate finding (FP triage path). |
| **Corpus** | The labeled adversarial dataset in [`bench/`](../bench/) used to compute per-detector precision/recall. [`docs/corpus-v0.1.md`](./corpus-v0.1.md). |
| **S-NNN** | A labeled **Sample** in the corpus (`bench/corpus/samples/...`). |
| **adversarial / benign / borderline** | The three corpus sample **labels**. |
| **Parity** | The TS↔Python detector equivalence guarantee ([ADR-0023](./decisions/)); enforced as a regression gate via `bench/scripts/parity_check.py`. |

## Metrics

| Term | Meaning |
|---|---|
| **P / R / F1** | **Precision / Recall / F1-score** — per-detector metrics in [`docs/evaluation.md`](./evaluation.md). |
| **KR** / **OKR** | **Key Result** / **Objectives and Key Results** — [`docs/okrs/2026-Q3.md`](./okrs/2026-Q3.md). |
| **G-A…G-G** | The acceptance **Gates** in the execution plan. |

## Standards & formats

| Term | Meaning |
|---|---|
| **SLSA** | **Supply-chain Levels for Software Artifacts** — provenance maturity framework. |
| **SBOM** | **Software Bill of Materials** (the prior art CBOM extends to agent-context). |
| **SPDX** | **Software Package Data Exchange** — license identifier + SBOM standard. |
| **SARIF** | **Static Analysis Results Interchange Format** — scanner output format (GitHub code-scanning). |
| **in-toto** | Supply-chain attestation framework; our Attestation is an in-toto Statement. |
| **CC-BY** | **Creative Commons Attribution** license (corpus content). |
| **OWASP** | Open Worldwide Application Security Project — see the [Top 10 for LLM crosswalk](./owasp-llm-top10-crosswalk.md). |
| **CVE** | **Common Vulnerabilities and Exposures** identifier. |
| **RFC 2119** | The IETF spec defining the **MUST / SHOULD / MAY** normative keywords used in canonical docs. |

## Stack & infrastructure

| Term | Meaning |
|---|---|
| **RLS** | **Row-Level Security** — Postgres multi-tenant isolation ([ADR-0006](./decisions/0006-postgres-rls-multi-tenancy.md)). |
| **OIDC** | **OpenID Connect** — auth via Authentik ([ADR-0007](./decisions/0007-authentik-for-oidc.md)). |
| **R2** | **Cloudflare R2** — content-addressed object storage. |
| **MCP** | **Model Context Protocol** — the agent tool/context protocol (PrimitiveHub ships an MCP server). |
| **LLM** | **Large Language Model**. |
| **AST** | **Abstract Syntax Tree** — used by structural detectors. |
| **CLI** | **Command-Line Interface** (`phub`). |
| **CI** | **Continuous Integration** (GitHub Actions). Distinct from **Context CI** — context matters. |

## Process & meta

| Term | Meaning |
|---|---|
| **ADR** | **Architecture Decision Record** — one file per load-bearing decision in [`docs/decisions/`](./decisions/) (`ADR-NNNN`). |
| **PR** | **Pull Request** — the mandated unit of change (PRs over direct-to-main, one logical change each). |
| **ICP** | **Ideal Customer Profile** — defined in [`docs/doctrine.md`](./doctrine.md). |
| **GTM** | **Go-To-Market**. |
| **NNN** | Placeholder for a zero-padded number in an ID template (e.g. `FP-NNN`, `CCI-NNN`). |

## Cryptographic vocabulary (locked — see [`CLAUDE.md`](../CLAUDE.md))

| Term | Meaning |
|---|---|
| **Content Digest** | SHA-256 hash of canonical content. Object key is always `sha256:<hex>`. |
| **Signature** | Ed25519 (planned via Sigstore keyless OIDC). **Never write "SHA-256 signed"** — SHA-256 is a hash, not a signature. |
| **Attestation** | A Context CI validation record — an in-toto Statement with PredicateType `https://primitivehub.ai/context-ci/v0.1/Attestation`. |
| **Provenance Chain** | author → validation → review → release. |

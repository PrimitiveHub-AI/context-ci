# Context CI Top 10 ↔ OWASP Top 10 for LLM Applications — crosswalk

> **Status:** Reference document. Authored 2026-06-05.
> **Companion ADR:** [ADR-0040](./decisions/0040-surface-architecture-and-anti-bloat-contract.md)
> (surface architecture — this doc lives in the *threat-encyclopedia*
> slot, not as a new product surface).
> **Sources mapped:** PrimitiveHub Context CI Top 10 v0.1
> ([`docs/threat-model.md`](./threat-model.md)) ↔ OWASP Top 10 for LLM
> Applications (2025).

## Why this document exists

Buyers and reviewers arriving from the security mainstream ask, reasonably,
*"how does your Top 10 relate to the OWASP LLM Top 10?"* This crosswalk
answers that **without expanding our taxonomy or adding a surface** — the
discipline locked by [ADR-0040](./decisions/0040-surface-architecture-and-anti-bloat-contract.md)
§4: ride a trend by *mapping*, not by *sprawling*.

The headline: **PrimitiveHub deliberately covers one slice of OWASP's
LLM risk surface — the agent-context supply-chain + injection slice —
scanned statically, at the artifact, before it ever reaches a model.**
We are the Context Firewall, not a runtime LLM-security platform. The
boundary below is the positioning, not an omission.

## The mapping (our category → OWASP LLM risk)

| Ours | Context CI category | Primary OWASP LLM mapping | Secondary | Relationship |
|---|---|---|---|---|
| **T1** | Prompt injection in Markdown body | **LLM01** Prompt Injection | LLM07 System Prompt Leakage | Direct. Static detection of the injection *artifact*, pre-runtime. |
| **T2** | Hidden Unicode / steganographic instructions | **LLM01** Prompt Injection | — | Injection delivery vector OWASP names but does not sub-enumerate. |
| **T3** | Encoded payloads (base64/hex/rot13/url) | **LLM01** Prompt Injection | LLM05 Improper Output Handling | Obfuscated injection; decode-and-execute shapes. |
| **T4** | Remote content fetch at load time | **LLM03** Supply Chain | LLM01 | Load-time external content = a supply-chain pull into context. |
| **T5** | Unsafe shell / `npx` install patterns | **LLM03** Supply Chain | — | The canonical mapping — this is our founding thesis. |
| **T6** | Credential exfiltration via instruction | **LLM02** Sensitive Information Disclosure | LLM06 Excessive Agency | Static detection of the exfil instruction in the artifact. |
| **T7** | Poisoned naming / typosquatting / impersonation | **LLM03** Supply Chain | — | Registry-level supply-chain integrity. |
| **T8** | Fake citations / fake expertise claims | **LLM09** Misinformation | — | Provenance-of-claim, detected statically. |
| **T9** | Copyright-contaminated primitives | **LLM03** Supply Chain | LLM04 Data & Model Poisoning | IP/provenance integrity of the context artifact. |
| **T10** | Context bloat / behavioral drift | **LLM10** Unbounded Consumption | LLM01 | Static, token-economic slice of the runtime consumption risk. |

**Coverage shape:** our Top 10 concentrates on **LLM01 (Prompt
Injection)** and **LLM03 (Supply Chain)** — five categories map to
Supply Chain, four to Prompt Injection. That concentration is the whole
point: it is precisely the agent-context attack surface the launch paper
argues has been under-defended.

## What we deliberately do NOT cover (the moat boundary)

These OWASP LLM categories are **out of scope by design**. They are
runtime / infrastructure / training-time concerns; PrimitiveHub scans
the *context artifact* statically, so they belong to a different
defense layer (a runtime gate, an MLOps pipeline, a RAG-infra audit) —
not to a context firewall.

| OWASP LLM | Why out of scope for a context firewall |
|---|---|
| **LLM04** Data & Model Poisoning | Training-time / fine-tune-time. We scan deployed context artifacts, not training corpora. (Partial touch via T9 provenance.) |
| **LLM05** Improper Output Handling | A property of the *consuming application's* output sink, not of the context artifact. (Partial touch via T3 decode-and-execute.) |
| **LLM06** Excessive Agency | A runtime tool-permission / orchestration concern. Belongs to the runtime-gate slot we do not yet fill (ADR-0040 §1). (Partial touch via T6.) |
| **LLM08** Vector & Embedding Weaknesses | RAG infrastructure (embedding store, retrieval). No context-artifact analog. |
| **LLM10** Unbounded Consumption | Primarily a runtime DoS / cost concern. We cover only its *static* token-economic slice (T10). |

Stating this boundary plainly is a credibility asset, not a gap to
apologize for: a tool that claims to cover all ten OWASP LLM risks
statically would be making a claim the paper could not defend.

## How to use this crosswalk

- **Answering "do you cover OWASP?"** — yes for the injection +
  supply-chain slice (LLM01/LLM02/LLM03/LLM09 + static LLM10); the rest
  is explicitly a different layer. Point to this table.
- **Evaluating a *new* category proposal** — per
  [ADR-0040](./decisions/0040-surface-architecture-and-anti-bloat-contract.md)
  §4, a category only enters the Top 10 when a crosswalk gap is both
  **in-scope** (a context-artifact concern, not runtime/training) **and**
  shippable as the full quadruple (taxonomy + Py + TS + corpus). None of
  the out-of-scope rows above qualify today.
- **Versioning** — this crosswalk pins OWASP LLM Top 10 (2025). When
  either taxonomy ratchets, re-map and date a new revision; do not edit
  in place silently.

## References

- [`docs/threat-model.md`](./threat-model.md) — Context CI Top 10 v0.1 (the canonical source for T1–T10)
- [ADR-0040](./decisions/0040-surface-architecture-and-anti-bloat-contract.md) — surface architecture & anti-bloat contract
- [ADR-0016](./decisions/0016-context-ci-top-10-versioning.md) — Context CI Top 10 versioning (taxonomy lock)
- [ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md) — the AV-vendor product-family frame
- OWASP Top 10 for LLM Applications (2025) — <https://genai.owasp.org/>

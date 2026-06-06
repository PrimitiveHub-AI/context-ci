# Paper bibliography

> **Status:** Citations for the arXiv paper accompanying PrimitiveHub's
> public launch. This file is the source of truth for what the paper
> cites; the paper's BibTeX will be generated from it. Add a row here
> whenever an ADR / threat-model section / evaluation claim relies on
> an external work.
>
> **Companion docs:** [`docs/threat-model.md`](./threat-model.md) (the
> 10-category threat taxonomy), [`docs/top10-corpus-map.md`](./top10-corpus-map.md)
> (how the taxonomy maps to corpus samples + detectors),
> [`docs/evaluation.md`](./evaluation.md) (per-detector P/R/F1 numbers).
>
> Citation key convention: `LastName:Year:short-title` (e.g.
> `Shai-Hulud:2025:npm-worm`). Use the key as the BibTeX identifier
> directly.

## Supply-chain incidents the threat model cites

### Shai-Hulud:2025:npm-worm
- **What:** September 2025 npm worm that propagated via package
  `postinstall` hooks, leveraging typosquat names and credential
  exfiltration to spread laterally across developer machines.
- **Why we cite it:** Names the canonical CCI-005 / CCI-007 attack
  family. Referenced in [`docs/threat-model.md`](./threat-model.md) § Scope.
- **URL:** Multiple post-mortems; see GitHub Security Advisory database.

### SolarWinds:2020:supply-chain
- **What:** Compromise of SolarWinds Orion update channel via the
  SUNBURST backdoor.
- **Why we cite it:** Foundational example of supply-chain compromise
  via signed-but-malicious build artifact. Motivates why "signing
  ≠ safety," cited in [`docs/principles.md`](./principles.md).

### Codecov:2021:bash-uploader
- **What:** Codecov bash uploader script modified to exfiltrate CI
  environment variables.
- **Why we cite it:** Direct precursor to the CCI-005 + CCI-006
  combination shape — a script fetched via curl AND exfiltrating
  environment secrets.

### ua-parser-js:2021:npm-typosquat
- **What:** Compromised `ua-parser-js` npm package shipped a
  cryptominer + credential stealer.
- **Why we cite it:** CCI-005 family: trusted package's `postinstall`
  hook turned into an attack vector after a maintainer-account compromise.

### eslint-config-prettier:2024:maintainer-compromise
- **What:** Maintainer-account compromise on a high-trust npm package.
- **Why we cite it:** Confirms CCI-007 (vendor impersonation) is not
  purely an outside-attacker shape — insider compromise renders the
  same threat surface.

### xz-utils:2024:CVE-2024-3094
- **What:** Long-running social-engineering campaign culminating in a
  backdoored `xz` tarball.
- **Why we cite it:** Justifies the "context primitives are
  supply-chain material" thesis — even infrastructure-tier code goes
  unverified for years.
- **Identifier:** CVE-2024-3094.

## Standards + provenance frameworks the design rests on

### SLSA:2023:provenance-spec
- **What:** Supply-chain Levels for Software Artifacts (SLSA), the
  provenance specification.
- **URL:** <https://slsa.dev/>
- **Why we cite it:** PrimitiveHub's Trust Bundle is a SLSA-style
  attestation extended for context primitives. See ADR-0011 and
  [`docs/spec.md`](./spec.md).

### in-toto:2016:supply-chain
- **What:** In-toto framework for attesting software supply-chain
  steps.
- **URL:** <https://in-toto.io/>
- **Why we cite it:** Predicate format the Trust Bundle inherits;
  [`docs/spec.md`](./spec.md) § "Attestation Predicate."

### Sigstore:2021:keyless-signing
- **What:** Sigstore + Fulcio + Rekor — keyless Sigstore signing
  via OIDC.
- **URL:** <https://www.sigstore.dev/>
- **Why we cite it:** Signing backend for PrimitiveHub v1 (public
  registry). See ADR-0011 for the abstraction.

### OWASP:2025:llm-top10
- **What:** OWASP Top 10 for LLM Applications (2025 edition).
- **URL:** <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
- **Why we cite it:** The crosswalk in
  [`docs/owasp-llm-top10-crosswalk.md`](./owasp-llm-top10-crosswalk.md) maps our
  CCI-NNN taxonomy to OWASP categories. The crosswalk justifies the
  scope boundary (we cover the injection + supply-chain slice
  statically; runtime / training-time defenses are a different layer).

### UTS39:2024:unicode-confusables
- **What:** Unicode Technical Standard #39 — Unicode Security
  Mechanisms, including the "skeleton" identifier-comparison method
  and confusables.txt.
- **URL:** <https://unicode.org/reports/tr39/>
- **Why we cite it:** Methodology for the T7 v0.3.0 generic
  homoglyph detector. See FN-011 closure log entry in
  [`docs/false-negative-resolution.md`](./false-negative-resolution.md).

### CommonMark:2024:spec
- **What:** CommonMark spec for markdown parsing.
- **URL:** <https://spec.commonmark.org/>
- **Why we cite it:** The fence-detection heuristics in
  `markdown_context.{py,ts}` follow CommonMark's fenced-code-block
  semantics. See ADR-0035.

### CVE:1999:taxonomy
- **What:** Common Vulnerabilities and Exposures (CVE) — MITRE
  identifier taxonomy.
- **URL:** <https://cve.mitre.org/>
- **Why we cite it:** CCI-008 detector flags implausible-year CVE
  identifiers; the 1999 lower bound is the CVE program's start year.

### USPTO:1790:patent-system
- **What:** US Patent and Trademark Office — patent issuance
  database; the patent program began 1790-04-10.
- **URL:** <https://patents.uspto.gov/>
- **Why we cite it:** CCI-008 detector flags US Patent citations
  with implausible year / number; 1790 is the lower bound.

## Methodology references

### Confusables:2017:phishing-detection
- **What:** Methodology of comparing identifiers via Unicode
  confusables for phishing-domain detection (Google Safe Browsing
  & related industry work).
- **Why we cite it:** Validates the UTS #39 skeleton method as a
  real-world detection technique outside academic literature.

### AntivirusTaxonomy:2010s:industry-practice
- **What:** AV vendor industry practice: FP submission portals, FN
  ledgers, signature databases, allowlists, cloud lookup. (Cited
  generally, not from a single source — this is industry consensus
  rather than a single paper.)
- **Why we cite it:** Direct parallel to PrimitiveHub's
  product family per
  [ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md). The
  FP / FN methodology in
  [`docs/false-positive-resolution.md`](./false-positive-resolution.md) +
  [`docs/false-negative-resolution.md`](./false-negative-resolution.md)
  follows AV-vendor norms.

## Evaluation methodology

### Powers:2011:evaluation-precision-recall
- **What:** Powers, D.M.W. (2011). "Evaluation: From Precision,
  Recall and F-Measure to ROC, Informedness, Markedness &
  Correlation."
- **Why we cite it:** Authoritative reference for the precision /
  recall / F1 measurements reported in
  [`docs/evaluation.md`](./evaluation.md).

### HoldoutValidation:1995:tradition
- **What:** Train / test split as overfit detection — industry
  practice since the 1990s.
- **Why we cite it:** Justifies the 80 / 20 holdout discipline in
  [ADR-0038](./decisions/0038-corpus-v0_2-expansion-and-holdout-split.md).

## Citation discipline

When the paper's evaluation section cites a number:

- The number itself: cite [`docs/evaluation.md`](./evaluation.md) by
  measurement date.
- The corpus the number was measured against:
  [`docs/corpus-v0.1.md`](./corpus-v0.1.md) + manifest version (v0.2 as
  of 2026-06-06).
- The detector implementation: cite the detector module + version (e.g.
  `t7.poisoned_naming` v0.3.0). The versions are in
  [`docs/top10-corpus-map.md`](./top10-corpus-map.md)'s Coverage Summary
  table.
- The methodology: cite the relevant ADR(s).
- The reproducibility claim: cite `bench/scripts/gate.sh` and
  `bench/cli/replay.py`.

No claim in the paper is allowed to assert a number without naming
the corpus + detector version + measurement date. This file is the
list of external citations that back the methodology those numbers
sit inside.

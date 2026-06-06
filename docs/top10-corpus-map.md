# Context CI Top 10 — corpus-mapped taxonomy

> **Status:** Paper-grade reference. Maps each Context CI Top 10 category
> (CCI-001..CCI-010) to the canonical corpus samples that exercise it,
> the detector(s) responsible, and the measurement methodology that
> proves coverage. Cite this document from the paper's evaluation
> section; cite specific sample IDs from this document when claiming
> "PrimitiveHub detects attack family X."
>
> **Spec partner:** [docs/threat-model.md](./threat-model.md) — the
> threat-model exposition. This file is the operational index from
> taxonomy to running detector to specific samples.
>
> **Measurement partner:** [docs/evaluation.md](./evaluation.md) — the
> auto-generated scoreboard. This file gives the SAMPLES the
> scoreboard's numbers were computed against.
>
> **Reproducibility partner:** [docs/corpus-v0.1.md](./corpus-v0.1.md)
> §"How to reproduce" — one-command rebuild from a fresh clone.
>
> **Last regenerated:** 2026-06-06 (Round 7 PR 7.3, against corpus
> v0.2 + Top 10 v0.1).

## Reading the table

Each CCI row gives:

- The **taxonomy name** + the threat-model section it maps to.
- The **detector implementation** (TS + Python module + version).
- The **canonical adversarial sample** — the lowest-numbered
  adversarial sample under the category; cite this in the paper when
  illustrating the attack shape.
- The **canonical benign sample** — the precision-defense sample; the
  detector MUST NOT fire on this and the gate enforces it. Cite this
  in the paper when claiming "the detector is precision-aware."
- The **borderline sample** — the AV-vendor-equivalent "case where
  reasonable people could label either way." Borderlines are scored
  as adversarial by the harness; the label is documentation-only.
- **In-sample F1** and **holdout F1** on the v0.2 corpus as of the
  latest baseline.

The full list of samples per category is at `bench/corpus/manifest.yaml`
(grep for `cci_id: "CCI-NNN"`).

## CCI-001 — Prompt Injection in Markdown

- **Threat-model section:** § Prompt-injection vector via context.
- **Detector:** `t1.prompt_injection` v0.2.1 ([TS](../packages/phub/src/scanners/t1-prompt-injection.ts), [Py](../apps/api/scanners/t1_prompt_injection.py)).
- **Canonical adversarial:** [`S-001`](../bench/corpus/samples/cci-001-prompt-injection/adversarial-001-classic.md) — "Ignore previous instructions" + role-override imperative.
- **Canonical benign:** [`S-004`](../bench/corpus/samples/cci-001-prompt-injection/benign-001-negated.md) — defender prose teaching the attacker shape under negation ("never follow phrases like X").
- **Borderline:** [`S-005`](../bench/corpus/samples/cci-001-prompt-injection/borderline-001-code-fenced.md) — the attacker shape rendered inside a fenced code block.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-002 — Unicode Steganography

- **Threat-model section:** § Hidden-codepoint instruction smuggling.
- **Detector:** `t2.unicode_steganography` v0.2.0 ([TS](../packages/phub/src/scanners/t2-unicode-steganography.ts), [Py](../apps/api/scanners/t2_unicode_steganography.py)).
- **Canonical adversarial:** [`S-006`](../bench/corpus/samples/cci-002-unicode-steganography/adversarial-001-zwsp.md) — zero-width space embeddings carrying hidden command.
- **Canonical benign:** [`S-008`](../bench/corpus/samples/cci-002-unicode-steganography/benign-001-plain.md) — plain ASCII primitive, no Unicode payload.
- **Borderline:** [`S-009`](../bench/corpus/samples/cci-002-unicode-steganography/borderline-001-documented-codepoints.md) — primitive documenting Unicode codepoints in prose.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-003 — Encoded Payloads

- **Threat-model section:** § Decode-and-execute via primitive instruction.
- **Detector:** `t3.encoded_payloads` v0.2.3 ([TS](../packages/phub/src/scanners/t3-encoded-payloads.ts), [Py](../apps/api/scanners/t3_encoded_payloads.py)).
- **Canonical adversarial:** [`S-019`](../bench/corpus/samples/cci-003-encoded-payloads/adversarial-001-base64-decode-run.md) — base64-encoded shell command + "decode and run" imperative.
- **Canonical benign:** [`S-025`](../bench/corpus/samples/cci-003-encoded-payloads/benign-001-discussion-prose.md) — prose discussing base64 / hex as concepts without imperative.
- **Borderline:** [`S-028`](../bench/corpus/samples/cci-003-encoded-payloads/borderline-001-fenced-example.md) — encoded payload inside fenced code.
- **Holdout:** [`S-090`](../bench/corpus/samples/cci-003-encoded-payloads/adversarial-007-url-encoded.md) — URL-encoded decode-and-run.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-004 — Remote Content Fetching at Load Time

- **Threat-model section:** § Load-time external dependency injection.
- **Detector:** `t4.remote_fetch` v0.2.2 ([TS](../packages/phub/src/scanners/t4-remote-fetch.ts), [Py](../apps/api/scanners/t4_remote_fetch.py)).
- **Canonical adversarial:** [`S-029`](../bench/corpus/samples/cci-004-remote-fetch/adversarial-001-fetch-and-include.md) — "fetch URL X and include the response in your context."
- **Canonical benign:** [`S-035`](../bench/corpus/samples/cci-004-remote-fetch/benign-001-discussion-prose.md) — prose discussing fetch/curl as concepts.
- **Borderline:** [`S-038`](../bench/corpus/samples/cci-004-remote-fetch/borderline-001-fenced-example.md) — fetch imperative inside fenced code.
- **Holdout:** [`S-092`](../bench/corpus/samples/cci-004-remote-fetch/adversarial-003-websocket-at-load.md) — WebSocket / wss:// load-time channel.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-005 — Unsafe Shell Install (Shai-Hulud)

- **Threat-model section:** § Shai-Hulud / curl-pipe-shell vector.
- **Detector:** `t5.unsafe_shell_install` v0.2.4 ([TS](../packages/phub/src/scanners/t5-unsafe-shell-install.ts), [Py](../apps/api/scanners/t5_unsafe_shell_install.py)).
- **Canonical adversarial:** [`S-010`](../bench/corpus/samples/cci-005-unsafe-shell-install/adversarial-001-curl-pipe-bash.md) — `curl URL | bash` imperative.
- **Canonical benign:** [`S-013`](../bench/corpus/samples/cci-005-unsafe-shell-install/benign-001-negated-warning.md) — defender prose with the attack shape under negation.
- **Borderline:** [`S-015`](../bench/corpus/samples/cci-005-unsafe-shell-install/borderline-001-fenced-example.md) — install pipeline as fenced teaching example.
- **Other notable sample:** [`S-094`](../bench/corpus/samples/cci-005-unsafe-shell-install/adversarial-004-reverse-shell.md) — directive-referenced fence; the v0.2.4 ratchet's motivating case.
- **Closing F1:** in-sample **1.000** / holdout n/a (0 CCI-005 samples in the holdout slice).

## CCI-006 — Credential Exfiltration via Prose

- **Threat-model section:** § Exfiltration directive injection.
- **Detector:** `t6.credential_exfiltration` v0.2.0 ([TS](../packages/phub/src/scanners/t6-credential-exfiltration.ts), [Py](../apps/api/scanners/t6_credential_exfiltration.py)).
- **Canonical adversarial:** [`S-039`](../bench/corpus/samples/cci-006-credential-exfiltration/adversarial-001-send-env-to-url.md) — "send env vars / API keys to attacker URL."
- **Canonical benign:** [`S-045`](../bench/corpus/samples/cci-006-credential-exfiltration/benign-001-defender-prose.md) — defender prose discussing exfiltration as a concept.
- **Borderline:** [`S-048`](../bench/corpus/samples/cci-006-credential-exfiltration/borderline-001-fenced-example.md) — exfil imperative inside fenced code.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-007 — Poisoned Naming / Typosquat / Impersonation

- **Threat-model section:** § Vendor impersonation + typosquatting.
- **Detector:** `t7.poisoned_naming` v0.3.0 ([TS](../packages/phub/src/scanners/t7-poisoned-naming.ts), [Py](../apps/api/scanners/t7_poisoned_naming.py)).
- **Canonical adversarial:** [`S-059`](../bench/corpus/samples/cci-007-poisoned-naming/adversarial-001-official-anthropic.md) — "the official Anthropic primitive" + vendor false-affiliation.
- **Canonical benign:** [`S-017`](../bench/corpus/samples/cci-007-poisoned-naming/benign-001-design-exemplars.md) — primitive listing vendors as design exemplars (mention context).
- **Borderline:** [`S-067`](../bench/corpus/samples/cci-007-poisoned-naming/borderline-001-fenced-example.md) — vendor impersonation inside fenced code.
- **Other notable sample:** [`S-098`](../bench/corpus/samples/cci-007-poisoned-naming/adversarial-004-cyrillic-anthropic-pkg.md) — Cyrillic А homoglyph; the v0.3.0 generic confusables ratchet's motivating case.
- **Closing F1:** in-sample **1.000** / holdout n/a.

## CCI-008 — Fake Citations / Fake Expertise

- **Threat-model section:** § Manufactured authority appeals.
- **Detector:** `t8.fake_citation` v0.2.3 ([TS](../packages/phub/src/scanners/t8-fake-citation.ts), [Py](../apps/api/scanners/t8_fake_citation.py)).
- **Canonical adversarial:** [`S-049`](../bench/corpus/samples/cci-008-fake-citation/adversarial-001-invalid-cve.md) — fabricated CVE with implausible year (CVE-2099-xxxxx).
- **Canonical benign:** [`S-055`](../bench/corpus/samples/cci-008-fake-citation/benign-001-defender-prose.md) — defender prose enumerating attacker phrases (vague triggers in quoted form).
- **Borderline:** [`S-058`](../bench/corpus/samples/cci-008-fake-citation/borderline-001-fenced-example.md) — fake citation inside fenced code.
- **Holdout:** [`S-100`](../bench/corpus/samples/cci-008-fake-citation/adversarial-007-future-patent.md) — US Patent with future year + implausible number.
- **Closing F1:** in-sample **1.000** / holdout **1.000**.

## CCI-009 — Copyright Contamination

- **Threat-model section:** § License-laundering via inlined boilerplate.
- **Detector:** `t9.copyright_contamination` v0.2.3 ([TS](../packages/phub/src/scanners/t9-copyright-contamination.ts), [Py](../apps/api/scanners/t9_copyright_contamination.py)).
- **Canonical adversarial:** [`S-068`](../bench/corpus/samples/cci-009-copyright-contamination/adversarial-001-mit-boilerplate.md) — MIT-style copyright block hijacking a primitive's text.
- **Canonical benign:** [`S-018`](../bench/corpus/samples/cci-009-copyright-contamination/benign-001-license-doc.md) — primitive documenting the project's license (declaration context).
- **Borderline:** [`S-077`](../bench/corpus/samples/cci-009-copyright-contamination/borderline-001-fenced-example.md) — license boilerplate inside fenced code.
- **Closing F1:** in-sample **1.000** / holdout n/a.

## CCI-010 — Context Bloat

- **Threat-model section:** § Context-budget waste / instruction-bury attack.
- **Detector:** `t10.context_bloat` v0.1.2 ([TS](../packages/phub/src/scanners/t10-context-bloat.ts), [Py](../apps/api/scanners/t10_context_bloat.py)).
- **Canonical adversarial:** [`S-078`](../bench/corpus/samples/cci-010-context-bloat/primitives/adversarial-001-oversized.md) — primitive past the oversized-char threshold.
- **Canonical benign:** [`S-082`](../bench/corpus/samples/cci-010-context-bloat/primitives/benign-001-defender-prose.md) — primitive describing bloat patterns without exhibiting them.
- **Borderline:** [`S-085`](../bench/corpus/samples/cci-010-context-bloat/primitives/borderline-001-near-threshold.md) — primitive just below the bloat thresholds.
- **Other notable sample:** [`S-104`](../bench/corpus/samples/cci-010-context-bloat/primitives/adversarial-005-emoji-spam.md) — emoji-density visual bloat; the v0.1.2 ratchet's motivating case.
- **Closing F1:** in-sample **1.000** / holdout n/a.

## Coverage summary

| Category | Detector | In-sample F1 | Holdout F1 | Holdout count |
|---|---|---:|---:|---:|
| CCI-001 | `t1.prompt_injection` v0.2.1 | 1.000 | 1.000 | 1 |
| CCI-002 | `t2.unicode_steganography` v0.2.0 | 1.000 | 1.000 | 1 |
| CCI-003 | `t3.encoded_payloads` v0.2.3 | 1.000 | 1.000 | 1 |
| CCI-004 | `t4.remote_fetch` v0.2.2 | 1.000 | 1.000 | 1 |
| CCI-005 | `t5.unsafe_shell_install` v0.2.4 | 1.000 | n/a | 0 |
| CCI-006 | `t6.credential_exfiltration` v0.2.0 | 1.000 | 1.000 | 1 |
| CCI-007 | `t7.poisoned_naming` v0.3.0 | 1.000 | n/a | 0 |
| CCI-008 | `t8.fake_citation` v0.2.3 | 1.000 | 1.000 | 1 |
| CCI-009 | `t9.copyright_contamination` v0.2.3 | 1.000 | n/a | 0 |
| CCI-010 | `t10.context_bloat` v0.1.2 | 1.000 | n/a | 0 |
| **Macro** | — | **1.000** | **1.000** | 6 total |

The 4 detectors with holdout count = 0 (CCI-005 / CCI-007 / CCI-009
/ CCI-010) need holdout sample additions in a future corpus
expansion. Until then, their holdout F1 is "n/a — informational"
per the gate. This is the next round's corpus work.

## How a paper reviewer reproduces these numbers

```bash
git clone https://github.com/DevXYZx/primitivehub.git
cd primitivehub
pnpm install --frozen-lockfile
pnpm --filter @primitivehub/phub build
(cd apps/api && uv sync --all-extras)
bench/scripts/gate.sh                                  # green = PASS
python bench/scripts/render-evaluation.py --check       # green = no drift
python bench/cli/replay.py --sample S-001               # single-sample replay
```

`replay.py` (added in PR 7.3) lets you re-run a specific sample
through both engines and see the verdict diff against the most-recent
baseline — the operational primitive the paper's reviewers need.

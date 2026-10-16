# Response to the PrimitiveHub Context CI Security Assessment (2026-10-16)

> Status of each finding from the preliminary architecture/contract audit.
> The reviewer's container could not reach GitHub/npm, so the review read
> the *published docs*, not our code. Several findings were already fixed
> in code that day; others are genuine and now addressed or planned.
> Commit refs are on `DevXYZx/primitivehub@launch`; a `0.1.2/0.1.3` release
> ships the code items to npm + the public repo.

## Headline
The reviewer independently re-derived our own Critical (**PH-001 = the
2026-09-30 forged-bundle report**) from the docs. We agree with it, and we
went past the minimum: the verifier now **fails closed** — `valid` is only
true when cryptographically authenticated, which is impossible in v0.1, so
a forged bundle is never `valid`, even to a third party reading `.valid`.

## Finding-by-finding

| ID | Severity | Status | Evidence / action |
|---|---|---|---|
| **PH-001** | Critical | **Fixed** | `verifyBundle` fails closed: `valid = inspected && authenticated`; `authenticated=false` in v0.1 → `valid` always false. Consumers refuse unauthenticated bundles (`BUNDLE_UNAUTHENTICATED`); `phub verify` exits non-zero + labels INSPECTED/AUTHENTICATED/REJECTED. Regression test = the reviewer's own PoC. Commits `b3b4f3f`,`1672127`,`ef0b944`. |
| **PH-002** | High | **Fixed (core) / hardening planned** | MCP `verify_before_load` now BLOCKS an unauthenticated supplied bundle; `authenticated` surfaced on the bundle check. Remaining: we still collapse the workspace verdict into `safe` — v0.2 will expose independent `scanned`/`locked`/`signed`/`authorized` booleans + a declared trust profile. |
| **PH-003** | High | **Fixed (honesty)** | Reworded `verify_before_load` to an **opt-in verification API** — registering the MCP server does NOT interpose on reads; enforcement needs host read-mediation. Removed "every agent MUST consult before reading." Commit `efb2ff9`. |
| **PH-004** | High | **Fixed** | Runtime **does** run all ten (CCI-001…010) — docs saying "T1/T2/T5" were stale. Added `detectorCoverage()` + a **CI gate** that fails if any advertised detector stops running. Commit `efb2ff9`. |
| **PH-005** | High | **Addressed (guidance) / enforcement roadmap** | Documented: `--update-lock`/`--lock-only` are dev tools and MUST NOT run in admission CI (sealing ≠ approval); CI must check scanner **and** lock together; CODEOWNERS on policy/lock/workflow. See `docs/usage/05-phub-lock.md` § Security. A machine-enforced "sealed-without-clean-scan is refused in gate mode" lands in the roadmap. |
| **PH-006** | High (conditional) | **Planned (v0.2)** | When real Sigstore lands, trust requires issuer **identity pinning** (expected OIDC subject + workflow), trusted Fulcio/Rekor roots, and a minimum backend level — `noop`/`staging` never satisfy production trust. Spec change drafted for the verify owner. |
| **PH-007** | Med-High | **Acknowledged (v0.2 roadmap)** | Offline revocation is a documented v0.1 limitation. Planned: signed revocation lists / trust-root updates / max attestation age. |
| **PH-008** | Medium | **Acknowledged — fixing** | Doc examples (`spec_version`/`content.digest`) disagree with the normative schema (`bundleVersion`/`content.bytesB64`). Action: generate examples from conformance fixtures + CI-validate. (verify-owner docs.) |
| **PH-009** | Medium | **Addressed (guidance)** | `actions/phub-scan` README now flags that enumerated `files` can miss unlisted context files (recommend full-workspace `phub audit`) and documents pinning `phub-version` + the action commit SHA for reproducibility. |
| **PH-010** | Medium | **Flagged → strategy** | Separate in-sample vs held-out F1 publicly; the held-out numbers already exist internally (TS recall ~0.83). Owner: phub-strategy/phub-web. |

## What the reviewer could not test (and now can)
- Code + npm are reachable: `npm pack @primitivehub/phub@0.1.3` (once released) / public repo `PrimitiveHub-AI/context-ci`.
- Their "release-blocker acceptance tests" map onto our suite: the forged-bundle PoC, the fail-closed invariant, and the detector-coverage gate are all now executable regression tests.

## Honest residual
We are **not** claiming a cryptographically-enforced trust gate yet — real
signature/cert/Rekor verification is v0.2 (PH-006/007). What changed: the
library and tools now **fail closed and say so**, and the published docs no
longer over-state enforcement. That closes the gap between "capable
scanner" and "honest-about-its-limits trust engine" — the full trust engine
is the v0.2 crypto work, tracked openly.

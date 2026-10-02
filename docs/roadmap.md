# PrimitiveHub Roadmap

> **Status:** Living document. Updated when a phase ships, when a
> phase scope changes, or when a new phase is added. Phases land in
> order; later phases may move based on what shipping earlier ones
> teaches us.
>
> **Companion:** [`docs/execution-plan.md`](./execution-plan.md) is the
> 18-week execution arc (Phases 5.5 → 10, dated 2026-06-01 → 2026-09-30)
> with explicit acceptance gates, weekly cadence, standards-governance
> work (Trust Contract / Top 10 / CBOM specs), workstreams, and a risk
> register. This roadmap is the phase ledger; the execution plan is how
> we ship the next phases.

## Where we are right now

Phase 3 complete + Phase 3.5 (auth round-out) shipping. Ten branches
stacked, post-Step-7-OIDC. The end-to-end Sign-in flow is live.

| Phase | State | Tag |
|---|---|---|
| 1 — UI shell + brand foundation | ✓ shipped | `v0.1.0-ui` |
| 2 — Architecture cleanup + monorepo | ✓ shipped | `v0.2.0-arch` |
| 3 — Backend bootstrap + first endpoints | ✓ shipped | branches stacked, pre-merge |
| 3.5 — Real OIDC + auth polish | ✓ shipped | branches stacked, pre-merge |
| 4 — Sigstore signing + Procrastinate workers | ◐ in progress | target Q1 2026 |
| **5 — Context CI v1: 10 stages, 10 threats** | ◐ in progress | target Q1 2026 |
| **5.5 — Runtime Trust API (bundle spec + endpoints + CLI + verify lib + MCP)** | ◐ in progress | target Q1-Q2 2026 |
| **5.7 — Active surfaces (audit / lock / watch / install / runtime gate)** | ◐ in progress | target Q2 2026 (ADR-0025) |
| **5.8 — Public `/check` paste-and-verdict lookup surface** | ◐ in progress | target Q2 2026 (ADR-0034) |
| 6 — Marketplace + search + downloads + reviews | ◯ planned | target Q2 2026 |
| 7 — Enterprise: self-host Sigstore, MinIO, schema-per-tenant | ◯ planned | target Q2 2026 |
| 8 — Observability + analytics | ◯ planned | target Q2-Q3 2026 |
| 9 — arXiv paper coordination + reviewer comms | ◯ planned | target Q3 2026 |
| 10 — Public launch | ◯ planned | target Q3 2026 (paper-coordinated) |
| 11 — Federation + cross-registry trust | ◯ planned | post-launch |
| 12 — Standards body submission (e.g., OASIS / IETF) | ◯ planned | post-launch + adoption |

## Phase-by-phase

### Phase 4 — Sigstore signing + Procrastinate workers (Q1 2026, in progress)

**Goal:** Every primitive publish produces a real Sigstore signature on
a real Rekor log entry. Async work (validation runs, attestation
generation, webhook delivery) moves off the request thread.

**Ships (PR-by-PR):**

- **PR #1** ✓ `feat/api-procrastinate-worker` — Procrastinate worker
  substrate + tenant-aware `ping` task; api-worker compose service;
  Postgres-backed queue.
- **PR #2** ✓ `feat/api-sigstore-backend-abstraction` — `SigstoreBackend`
  Protocol + 4 backends (`public` / `staging` / `self-hosted` / `noop`);
  in-toto Statement builder; env-driven factory (ADR-0011).
- **PR #3** ✓ `feat/api-sigstore-keyless-signing` — fills in `sign()` on
  real backends using `sigstore-python`'s `SigningContext`. Bundle →
  `SigningResult` field extraction (parses `Bundle.to_json()` not
  `_inner`; future-proof against sigstore-python internal refactors).
  34 mocked unit tests; 1 gated integration test against sigstage.
- **PR #4** ✓ `feat/api-sign-on-upload` — wires `get_backend()` into the
  upload endpoint via a Procrastinate task. Attestation state machine
  (`pending → signing → signed | failed`). Idempotency-keyed task; GET
  `/attestation` endpoint surfaces the full Sigstore field set. 7 new
  e2e tests; 93/93 total green.
- **PR #5** ✓ `feat/web-attestation-badge-and-rekor-link` — UI surface
  for attestation status. `<AttestationBadge>` renders 4 states
  (signed/pending/failed/unsigned) as subtle inline pills (Tufte
  restraint — trust whispered, not shouted). `useAttestation()` polls
  while in-flight via TanStack Query. Rekor verify-link opens in new
  tab with log_index displayed.

**Locked architectural commitments:**
- Backend abstraction (one env var swap) so Phase 7 isn't a migration.
- In-toto Statement predicateType locked to
  `https://primitivehub.ai/context-ci/v0.1/Attestation` per docs/spec.md.
- Idempotency keys on every external side effect (Sigstore, webhook,
  email).
- "Trusted" badge requires `attestation.signed_at IS NOT NULL` AND a
  valid Rekor entry.

**Success metric:** A primitive published in dev produces a Rekor entry
the maintainer can paste into the appropriate Rekor search UI
(sigstage.dev for dev; sigstore.dev for prod) and verify.

### Phase 5 — Context CI v1: 10 stages, 10 threats (Q1 2026, in progress)

**Goal:** The 10 supply-chain attack categories in `docs/threat-model.md`
each have a working detector. A primitive run through the pipeline
produces a structured verdict per category. The cryptographic
attestation from Phase 4 now binds the signer to the FULL validation
result — "Trusted" stops being a sticker and becomes a verifiable
safety claim.

**Ships (PR-by-PR):**

- **PR 5.1** ✓ `feat/api-scanners-and-t1-prompt-injection` — scanner
  scaffold (`apps/api/scanners/`), `Detector` Protocol + `Verdict`
  dataclass (ADR-0012), T1 prompt-injection detector with 4 pattern
  families (override / role-hijack / hidden-instructions /
  exfil-hint), 24 unit tests, sign-task wiring (detectors run before
  signing; verdicts merged into attestation predicate).
- **PR 5.2** ✓ `feat/api-t5-unsafe-shell-install` — Shai-Hulud
  detector. 4 pattern families: shell-pipe-from-network (`curl | sh`
  + 4 variants), npx-arbitrary-install, pip-arbitrary-install,
  install-instruction-to-agent. 21 unit tests. Registry now has T1 + T5.
- **PR 5.3** ✓ `feat/api-t2-unicode-steganography` — the "didn't think
  of that" detector. 4 families: zero-width-invisible (ZWSP/ZWNJ/ZWJ/WJ/
  BOM), bidi-control (LRO/RLO/LRE/RLE/PDF/LRI/RLI/FSI/PDI), tag-character
  (U+E0000-U+E007F), mixed-script-confusable (Latin+Cyrillic / Latin+Greek
  homoglyphs). 24 unit tests. **Launch-demo trifecta complete:** T1
  (prompt injection) + T5 (Shai-Hulud) + T2 (steganography). Registry
  now [T1, T2, T5] in threat-category order. Ironic self-test: ruff's
  RUF001/002/003 caught the same payloads my detector catches — same
  defense family.
- **PR 5.4** `feat/api-pipeline-orchestration` — materialize
  `validation.PipelineStage` rows from the predicate; gate
  `verdict=Trusted` on all-pass; parallel detector execution.
- **PR 5.5** `feat/api-malicious-primitive-test-suite` — one
  purposely-evil primitive per category; proves detectors catch them;
  becomes the launch demo + paper evaluation set.
- **PR 5.6** `feat/api-t3-t4-t6-t7-t8-t9-t10` — remaining 7 detectors,
  batched 2-3 per micro-PR.
- **PR 5.7** `feat/web-pipeline-stage-live` — UI surfaces live
  `validation.PipelineStage` rows on `/primitive/[slug]` (currently
  mocked).

**Locked architectural commitments:**
- Detector Protocol is stateless + pure (ADR-0012) — parallelism is
  safe by construction.
- Verdicts serialize directly into `attestation.predicate.validation[]`
  via `Verdict.as_predicate_dict()`; no separate serializer.
- Detector versions are recorded — a verifier can tell if a stale
  detector produced the verdict.

**Success metric:** A purposely-malicious primitive (one per category,
authored as part of the test suite) gets blocked at the right stage and
NEVER reaches `Trusted`. The attestation predicate truthfully records
WHY it was blocked.

### Phase 5.5 — Runtime Trust API (Q1-Q2 2026, in progress)

**Goal:** Turn PrimitiveHub from a destination (humans browse the
registry) into infrastructure (AI agents query it at runtime to
verify their context). The cryptography we built in Phase 4 + the
validation we built in Phase 5 become directly consumable by Claude
Code, Cursor, Copilot, Aider, and any MCP-speaking agent.

Rationale: see `docs/innovation/runtime-trust-api.md`. The "Snyk
play" — be the verifier on top of every registry, not the only
registry. Vendor-absorption hedge.

**Ships (PR-by-PR):**

- **PR 5.5.1** ✓ `feat/api-bundle-spec-and-trust-endpoint` — bundle
  format spec (`docs/spec.md` § 10), wire-contract ADR-0013, two
  HTTP endpoints (`/api/v1/trust/{slug}/versions/{semver}` +
  `/api/v1/trust/by-digest/{digest_hex}`), 6 tests, full IDOR
  posture matches the rest of the registry. Auth required for now;
  public-anonymous lookup ships in 5.5.2.
- **PR 5.5.2** ✓ `feat/api-public-trust-lookup` — visibility as a
  first-class RLS concept (ADR-0014). 5 new RLS policies (one per
  tenant-scoped registry table) OR with the existing tenant_isolation
  policies; the same `primitivehub_app` role serves both auth + anon
  reads. No role switching. Trust endpoints lose `@requires_auth` +
  gain Cache-Control / Content-Type headers per spec § 10.6. 4 new
  tests (anonymous public OK, RLS hides private via direct SQL check,
  cache headers immutable on by-digest + 24h on by-slug). The
  Snyk-overlay shape is now live: any client anywhere can `GET
  /api/v1/trust/by-digest/<hex>` and get back a verifiable bundle for
  any public primitive, no account needed.
- **PR 5.5.3** `feat/phub-cli-fetch-verify-cache` — `phub` CLI MVP.
  `phub fetch <slug>@<semver>` pulls + verifies + caches; `phub
  verify <file>` validates a local primitive against its bundle;
  `phub cache prune` housekeeping. Reads bundles from the trust
  endpoints.
- **PR 5.5.4** `feat/context-ci-verify-oss-library` — `context-ci-
  verify` open-source library (Python + TypeScript), MIT licensed,
  no PrimitiveHub runtime dependency. Verifies any bundle against
  any Sigstore trust root. The distribution-moat artifact.
- **PR 5.5.5** `feat/primitivehub-mcp-server` —
  `@primitivehub/mcp-server`. Thin shim over the HTTP API; exposes
  `primitivehub.search` / `primitivehub.fetch` / `primitivehub.verify`
  tools to Claude Code / Cursor / any MCP-speaking agent. `claude
  mcp add primitivehub` becomes a one-line install.

**Locked architectural commitments:**

- Bundle is **self-contained** — verification works offline against
  bundled Sigstore trust roots (ADR-0013).
- Media type `application/vnd.primitivehub.bundle+json` is the
  registered wire format; third parties can produce conformant
  bundles.
- Content-addressed (`/trust/by-digest/<hex>`) is the canonical
  lookup; slug-based (`/trust/{slug}/versions/{semver}`) is
  convenience. By-digest bundles cache `immutable`; by-slug max-age 24h.
- `context-ci-verify` library has no runtime dependency on
  PrimitiveHub — it verifies bundles wherever they came from.

**Success metric:** an external developer who has never used
PrimitiveHub's web UI can `pip install context-ci-verify`, paste a
bundle JSON, and verify a primitive's signature + Context CI verdicts
without any network call to primitivehub.ai.

### Phase 5.7 — Active surfaces (Q2 2026, in progress)

**Goal:** Convert the CLI + GitHub Action from *passive* (lint a file
you point at) to *active* (discover every agent-context artifact in a
project, classify it, scan it, lock it, guard it at runtime). This is
the half of `docs/vision.md` that turns "context can be inspected,
verified, attested, and revoked" from a thesis into observable default
behavior.

Locked in [ADR-0025](./decisions/0025-active-posture-and-phub-audit.md).
The active-surfaces arc is five PRs; each subsequent surface ships
under its own ADR (0026–0029) once the foundation lands.

**Ships (PR-by-PR):**

- **PR 5.7.1** ◐ `feat/phub-audit` — `phub audit [<path>]` walks the
  project, classifies every context artifact (AGENTS.md / CLAUDE.md /
  `.cursorrules` / `.claude/skills/**` / `**/primitives/**` /
  `**/mcp.json` / etc.), digests each file (SHA-256), runs the existing
  T1/T2/T5 detector roster, and emits a project-level report (human /
  JSON / SARIF). Zero new detectors; orchestration surface only.
  Foundation for PRs 5.7.2–5.7.5. ADR-0025.
- **PR 5.7.2** ◐ `feat/phub-lock` — `phub.lock` format
  ([ADR-0026](./decisions/0026-phub-lock-format-and-drift-detection.md))
  + `phub audit --check-lock` / `--update-lock` / `--lock-only` /
  `--lock-path`. Canonical-JSON file at `.primitivehub/phub.lock`
  records `(path, classification, digest, attestation-status)` for
  every classified artifact. Reproducibility is the load-bearing
  property: re-stamping against an unchanged working tree produces a
  byte-identical file. CI fails on drift via `--check-lock`. Drift
  categories: added / modified / removed / reclassified. The
  AV-product-family equivalent of the boot-time integrity check
  (ADR-0030 § 3). 31 new tests; 159/159 passing.
- **PR 5.7.3** ◯ `feat/phub-watch` — long-running filesystem watcher;
  new context artifacts get auto-scanned and quarantined until
  approved into the lock. Future ADR-0027.
- **PR 5.7.4** ◯ `feat/phub-install` — `phub install <slug@semver>`.
  Safe replacement for the `npx … | bash` skill-install attack class
  (T5). Pulls from the registry, verifies the Trust Bundle,
  content-addresses the install path, records the install in
  `phub.lock`. Refuses unattested installs without `--unsafe`.
  Future ADR-0028.
- **PR 5.7.5** ◯ `feat/mcp-runtime-gate` — promotes
  `@primitivehub/mcp-server` (Phase 5.5 PR 5.5.5) to a runtime gate
  with `primitivehub.verify_before_load(artifact_ref)`. Agent runtimes
  call it before loading any primitive; refuses-by-default for
  unattested or revoked content. Already on the Phase 5.5 roadmap as
  the MCP server; this PR confirms the gate semantics. Future ADR-0029.

**Locked architectural commitments:**

- The walker, classifier, lockfile, and runtime gate all reuse the
  existing scanner kernel + verifier kernel. NO surface introduces
  parallel trust logic — the Trust Contract is still the spine
  (per ADR-0015 and the execution-plan one-line bet).
- Classification list is versioned alongside the Top 10 (ADR-0016).
  New artifact classes ship as minor-version bumps because they
  describe the attack surface, not the implementation.
- Discovery is deterministic (path-pattern matching, not LLM
  heuristic) so the audit verdict is auditable.
- Every active surface integrates the FP-resolution methodology
  ([ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md)
  + [`docs/false-positive-resolution.md`](./false-positive-resolution.md)).
  Allow entries in `.primitivehub/policy.yaml` are back-referenced by
  numbered FP-NNN ledger entries; allowlists decay on a quarterly +
  Top-10-version-bump re-review cadence. The AV-vendor product-family
  parallel is the load-bearing framing for the whole active-surfaces
  arc.

**Success metric:** an operator at any organization can run `npx
@primitivehub/phub audit` against an unfamiliar repository and get
back a complete inventory of agent-context artifacts + a verdict on
each, with no prior knowledge of which files matter. The "find every
piece of context an agent loads" promise from the vision is reachable
in one command.

**Companion measurement track — Adversarial Corpus v0.1
(ADR-0032, 2026-06-04):** the active-surfaces arc ships with a
paper-citable labeled dataset under `bench/corpus/` and cross-
language precision/recall measurement scripts (`bench/scripts/
measure.{ts,py}`). v0.1 ships 15 seed samples (CCI-001 + CCI-002 +
CCI-005); v0.3 launch-day target is 500+ samples across all 10
Top 10 categories. Cross-language parity (ADR-0023) becomes
mechanically gated: a regex change on one side that introduces
parity drift against the corpus cannot merge without the matching
change on the other side. Risk R-7 (corpus too small for credible
paper claims) is partially mitigated; the patient labeling
continues to launch.

### Phase 5.8 — Public `/check` paste-and-verdict lookup surface (Q2 2026, in progress)

**Goal:** A browser surface at `primitivehub.ai/check` where any
practitioner can paste a suspicious AI skill / URL / `npx` command
and get a deterministic Top 10 verdict in under five seconds, with
no account. The AV-product-family "Cloud lookup / reputation
service" row (ADR-0030 § 3) upgraded from *digest-only,
programmatic* (ADR-0013) to *paste-anything, browser*.

Locked in [ADR-0034](./decisions/0034-public-check-lookup-surface.md).

**Ships (one PR):**

- **PR 5.8.1** ◐ `feat/check-public-lookup` — Django `checks` app
  + `POST /api/v1/check` anonymous endpoint (rate-limited
  30/5min/IP, 500/day/IP); three input modes: `content` paste,
  `https://` URL fetch (SSRF-guarded), `npx @scope/name@version`
  static tarball analysis (never executes the package); Next.js
  `/check` page with three-tab UI + deterministic trust score
  (`100 − 25·FAIL − 10·WARN`) + per-detector verdicts with
  line-numbered diff hints. Zero new detectors; thin surface over
  the existing Python `get_all_detectors()` set (ADR-0023).

**Locked architectural commitments:**

- **Static analysis only.** The `npx` resolver fetches the
  registry tarball and unpacks it under hard caps (8 MiB
  compressed / 64 MiB uncompressed / 4000 entries / 15s) — no
  `postinstall`, no `require()`, no code execution. AV scanners
  read bytes; we do the same. (ADR-0034 § 2.)
- **No persistence of pasted bytes.** Verdict metadata is logged
  for telemetry; the input itself is scanned and dropped. A user
  pasting a credential to ask if a skill is exfiltrating
  credentials does not see their credential become our log entry.
  (ADR-0034 § 5.)
- **Trust score is reproducible.** Same content → same score, no
  ML, no community signal, no vibes number. Honored per
  `feedback-no-fake-numbers`. (ADR-0034 § 4.)
- **Anonymous; no login.** The daily-use frame ("is this skill
  safe?") fails if it requires an account. Abuse is bounded by
  per-IP rate limits, not by sign-up friction. (ADR-0034 § 5.)
- **Detectors are the Python set, not a parallel TS path.** The
  detector pipeline that signs primitives also scores `/check`
  pastes. One canonical implementation. (ADR-0034 § 6.)

**Success metric:** a practitioner who has never heard of
PrimitiveHub pastes a real-world malicious skill into `/check`
and gets back a FAIL verdict naming which Top 10 categories
fired and where, in under five seconds. The first 30 seconds of
their PrimitiveHub experience demonstrates the category.

### Phase 6 — Marketplace + search + downloads + reviews (Q2 2026)

**Goal:** The site becomes browseable. `/registry`, `/bundles`,
`/contributors`, `/validation` all hit live counters, search returns
live results, reviewers can act on review-queue items.

**Ships:**
- Postgres FTS for primitive search (slug + name + description +
  use_when + category). Meilisearch deferred to post-launch.
- Append-event downloads counter (per `ddia-multi-tenant`: no
  row-updates on hot rows).
- Reviewer actions: Approve / Reject / Request changes wire through to
  `validation.ReviewItem` with audit trail.
- Real reputation formula: peer-validated quality + decay; replaces
  the placeholder `60 + 5×primitives + 2×reviews` formula.
- Bundle install command produces an installable archive.
- Profile pages (`/contributors/{slug}`) wire to the contributor view.

**Success metric:** A new author can publish a primitive, see it
indexed, watch it progress through Context CI, get reviewed, and ship
to `Trusted` end-to-end without engineer intervention.

### Phase 7 — Enterprise: self-host Sigstore, MinIO, schema-per-tenant (Q2 2026)

**Goal:** The product is deployable inside an enterprise's perimeter
without depending on public Sigstore (which would publicly disclose
private-registry author identities via Rekor).

**Ships:**
- Self-hosted Sigstore: Fulcio + Rekor + Trillian deployment recipe.
- MinIO swap-in for R2; same S3 API, same content-addressed key
  scheme.
- Optional schema-per-tenant Postgres model for enterprises with hard
  isolation requirements (shared-schema-with-RLS stays the default).
- SSO via SAML / OIDC mapping to organization-membership-as-claim.
- Audit-log export (admin actions, publish events, attestation rotations).
- Helm chart for k8s deployment.

**Success metric:** A design partner runs PrimitiveHub in their own
VPC, publishes a primitive, verifies it via their own Sigstore, all
without traffic leaving the perimeter.

### Phase 8 — Observability + analytics (Q2-Q3 2026)

**Goal:** We can answer "what's the registry doing right now?" with
real data, not guesses.

**Ships:**
- Structured JSON logs to a chosen aggregator (Grafana Loki + Tempo
  pattern, or OpenTelemetry → vendor of choice).
- p50/p95/p99 latency dashboards for the ritual paths (publish, read,
  verify) per `ddia-multi-tenant`.
- Per-tenant cost attribution (R2 bytes, Postgres rows, signing ops).
- Anomaly alerts: failure-rate spikes, Sigstore-call timeouts, Rekor
  inclusion delays.

**Success metric:** A maintainer answers "is the registry behaving" in
≤2 dashboard glances without SSH-ing into a host.

### Phase 9 — arXiv paper coordination + reviewer comms (Q3 2026)

**Goal:** The paper is submission-ready. Reviewers (academic + industry)
have early access. Citations to in-toto, Sigstore, SLSA, the
Shai-Hulud incident, xz, etc. are correct and current.

**Ships:**
- `docs/paper/` — LaTeX sources, figures, threat-model reference
  appendix, evaluation results from Phase 5 scanner runs.
- A reviewer-access feature on the (still-private) registry: a special
  link grants read-only access for paper reviewers without exposing
  full marketplace UX.
- Pre-publication checklist (terminology consistency, threat-model
  version bump if needed, spec version freeze for paper-aligned
  release).

**Success metric:** Paper accepted at a venue (or arXiv preprint with
≥5 citations within 90 days of posting).

### Phase 10 — Public launch (~~Q3 2026, paper-coordinated~~ → product-first, owner-triggered)

> **Superseded 2026-06-07 by [ADR-0045](./decisions/0045-product-first-public-launch-and-distribution-repo.md):**
> launch is **product-first**, decoupled from the (owner-owned) arXiv paper.
> Distribution = one public repo `primitivehub/context-ci` + npm. Irreversible
> go-public flips are human-only. Package publish need not wait on the paper;
> the website flip waits on Explorer + Forge round-trip + `/check` + seed catalog.

**Goal:** The product goes public when it's ready, on the owner's trigger.
First impression matters: every surface ships in trust-defining
state.

**Ships:**
- Lift `noindex` defenses, social posts, domain DNS pointing
  primitivehub.ai at the prod stack.
- Launch primitives: a seed catalog of 100+ attested primitives across
  every threat-category-relevant domain.
- Bug bounty program announcement.
- A 5-minute video demoing publish → attest → verify → consume.
- Public Discord / Slack / mailing list (TBD on which).

**Success metric:** ≥1,000 unique authors registered, ≥10,000
primitive reads, ≥5 unsolicited blog posts in the first 30 days.

### Phase 11 — Federation + cross-registry trust (post-launch)

**Goal:** Enterprises running their own private PrimitiveHub
instances can federate with the public registry (or with each other)
without compromising tenant boundaries.

**Ships:**
- Cross-registry attestation verification (a primitive's signature
  produced under one Sigstore instance is verifiable from another).
- Federation handshake protocol (out-of-band trust-root exchange).
- Mirror-and-verify pattern: a private registry can pull + verify a
  public primitive without proxying every request.
- Full copyright/lineage scanning (the deferred half of T9).

**Success metric:** A primitive published on the public registry is
provably installable + verifiable from a private enterprise instance
with no public-registry network call at install time.

### Phase 12 — Standards body submission (post-launch + adoption)

**Goal:** The Primitive Spec + Attestation predicate become canonical
references in a standards body — OASIS, IETF, OpenSSF, or CNCF
sandbox.

**Ships:**
- Spec rewritten in standards-body-format (RFC-style or OASIS spec
  format).
- Reference implementations in ≥3 languages (Python, TypeScript, Go).
- Interoperability test suite.

**Success metric:** A widely-adopted agent framework adopts the spec
as a load-bearing reference (i.e., they cite us, not their own
internal format).

## How to use this document

When prioritizing work, ask:

1. Which phase does this belong to?
2. Is it on the critical path for the **next** phase, or further out?
3. If further out, is there a Phase X reason to do it early (e.g., it
   unblocks a paper experiment)?
4. If unrelated to any phase — does the [vision](./vision.md) bless it,
   or is it scope creep?

Pull-requests should reference a phase in their description. PRs that
don't fit any phase trigger a roadmap-update discussion before they
merge.

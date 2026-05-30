# PrimitiveHub Roadmap

> **Status:** Living document. Updated when a phase ships, when a
> phase scope changes, or when a new phase is added. Phases land in
> order; later phases may move based on what shipping earlier ones
> teaches us.

## Where we are right now

Phase 3 complete + Phase 3.5 (auth round-out) shipping. Ten branches
stacked, post-Step-7-OIDC. The end-to-end Sign-in flow is live.

| Phase | State | Tag |
|---|---|---|
| 1 — UI shell + brand foundation | ✓ shipped | `v0.1.0-ui` |
| 2 — Architecture cleanup + monorepo | ✓ shipped | `v0.2.0-arch` |
| 3 — Backend bootstrap + first endpoints | ✓ shipped | branches stacked, pre-merge |
| 3.5 — Real OIDC + auth polish | ✓ shipped | branches stacked, pre-merge |
| **4 — Sigstore signing + Procrastinate workers** | ◐ NEXT | target Q1 2026 |
| 5 — Context CI v1: 10 stages, 10 threats | ◯ planned | target Q1 2026 |
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
- **PR #5** `feat/web-attestation-badge-and-rekor-link` — UI surface for
  attestation status + Rekor entry link.

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
- **PR 5.2** `feat/api-t5-unsafe-shell-install` — most-cited threat in
  the supply-chain narrative; killer demo content (Shai-Hulud vector).
- **PR 5.3** `feat/api-t2-unicode-steganography` — zero-width chars,
  RTL overrides, lookalike Cyrillic. The "didn't think of that"
  factor for the paper.
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

### Phase 10 — Public launch (Q3 2026, paper-coordinated)

**Goal:** The site goes public on the same day the paper appears.
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

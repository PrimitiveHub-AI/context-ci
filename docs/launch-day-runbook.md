# Launch-day runbook

> **Status:** v0.1 executable runbook for flipping PrimitiveHub from
> pre-launch (localhost-only, noindex, sigstage backend) to public
> (TLS-terminated, indexable, public Sigstore). EVERY step is gated on
> explicit user approval; this document is the script the operator
> reads, not a tool that auto-executes.
>
> **Owner of the launch:** mhm (project owner). Claude's role is to
> execute steps when explicitly authorized, ONE step at a time, with
> verification before proceeding to the next.
>
> **Pre-flight authority:** [CLAUDE.md hard-rule #3 (localhost-only)](../CLAUDE.md),
> [CLAUDE.md hard-rule #5 (no public deploys without paper)](../CLAUDE.md),
> [ADR-0031 pre-launch posture automation](./decisions/0031-pre-launch-posture-automation.md).
>
> **Cost of error:** highest in the entire project. A single
> mis-configured DNS record or missed `noindex` defense leaks the
> project before the paper publishes — defeating the pre-launch
> posture work of the last six months.

## How to read this document

Each phase is one or more numbered steps. Each step has:

- **Goal:** what success looks like.
- **Action:** the literal command(s) or file edit.
- **Verify:** how to confirm the step worked (output you should see).
- **Rollback:** the literal command(s) to undo this step in isolation.
- **Approval:** the explicit user-gated checkpoint before proceeding.

The runbook is INTENTIONALLY VERBOSE. Operator fatigue or rushing on
launch day is precisely the failure mode CLAUDE.md hard-rule #3 § "six
layers, not one" warns about. Slow is safe.

## Phase 0 — Pre-flight (T minus 24h)

### Step 0.1 — Verify pre-launch posture is still intact

- **Goal:** all six layers of pre-launch posture pass.
- **Action:** `scripts/check-pre-launch-posture.sh`
- **Verify:** every layer reports SAFE; exit code 0.
- **Rollback:** n/a (read-only check).
- **Approval:** N/A — this is a read step. If ANY layer reports
  UNSAFE, STOP. Do not proceed to launch until the offending layer
  is restored.

### Step 0.2 — Verify gate is green on the latest commit

- **Goal:** the corpus regression gate, parity check, and
  evaluation-drift gate are all PASS on the head of `main`.
- **Action:** `bench/scripts/gate.sh && python3 bench/scripts/render-evaluation.py --check`
- **Verify:** "GATE: PASS  (no F1 regression > tolerance; Py↔TS
  parity intact)" + "drift: no" on the evaluation render.
- **Rollback:** n/a.
- **Approval:** N/A. If FAIL, STOP and resolve the regression
  before launch.

### Step 0.3 — Verify paper draft is at intended state

- **Goal:** `paper/main.tex` is at the version intended for arXiv
  submission. Render-ready prose, not skeleton stubs.
- **Action:** `latexmk -pdf paper/main.tex` (or whatever the
  Makefile wires up).
- **Verify:** PDF generated; no missing references; cited numbers
  match `docs/evaluation.md`.
- **Rollback:** revert to the prior tagged paper state.
- **Approval:** explicit operator OK on the rendered PDF. The
  paper is the LAUNCH ARTIFACT; the registry serves it.

### Step 0.4 — Verify Sigstore backend test (sigstage)

- **Goal:** the sigstage.dev signing path works end-to-end against
  the dev environment.
- **Action:** `docker compose exec api uv run python -m primitivehub_api.manage shell -c "from signing.backends import sign; sign(test_artifact)"` (placeholder — concrete invocation in apps/api/signing/).
- **Verify:** signature emitted; verification round-trip OK.
- **Rollback:** n/a.
- **Approval:** N/A. If FAIL, the production Sigstore backend
  CANNOT be flipped — sign path must work in dev first.

### Step 0.5 — Verify Hetzner host has headroom

- **Goal:** the production host has ≥ 4 GB available memory and
  ≥ 10 GB disk free.
- **Action:** SSH to host; `free -h && df -h /`.
- **Verify:** `available` > 4 GB; `/` free > 10 GB.
- **Rollback:** n/a.
- **Approval:** N/A. If short, upsize the Hetzner box BEFORE
  launch.

## Phase 1 — Posture review (T minus 6h)

### Step 1.1 — Snapshot the current state to a tagged commit

- **Goal:** a single commit captures the "pre-launch posture"
  state so rollback to a known-clean state is one git command.
- **Action:**
  ```
  git tag pre-launch-snapshot-$(date -u +%Y%m%d) HEAD
  git push origin pre-launch-snapshot-$(date -u +%Y%m%d)
  ```
- **Verify:** `git tag --list 'pre-launch-snapshot-*'` shows the tag.
- **Rollback:** `git tag -d <tag>` (if you mis-named it).
- **Approval:** explicit user OK on the tag name.

### Step 1.2 — Verify the rollback path works

- **Goal:** know the rollback command works BEFORE you need it.
- **Action:** on a SCRATCH host (NOT production), do a `git checkout pre-launch-snapshot-NNNNNN` + `docker compose up` cycle.
- **Verify:** scratch host comes up in pre-launch posture.
- **Rollback:** n/a (the rollback test IS the rollback).
- **Approval:** explicit user OK that the rollback works.

### Step 1.3 — Verify DNS pointer is staged

- **Goal:** the DNS record for `primitivehub.ai` → Hetzner IP is
  AUTHORED in the registrar UI but NOT YET PUBLISHED.
- **Action:** in the DNS provider's UI, draft the A / AAAA records
  pointing primitivehub.ai → <Hetzner-IP>. Do NOT save.
- **Verify:** `dig primitivehub.ai A` still returns NXDOMAIN
  (or whatever the current state is).
- **Rollback:** discard the draft in the DNS UI.
- **Approval:** explicit user OK after seeing the draft.

## Phase 2 — The flip (T minus 0h)

> **Critical:** Phase 2 steps are ORDERED. Each step depends on the
> prior step completing. Do not parallelize.

### Step 2.1 — Reverse proxy + TLS termination

- **Goal:** Caddy (or Traefik) terminates TLS for primitivehub.ai
  and proxies to the localhost-bound web service.
- **Action:**
  1. SSH to production host.
  2. `cp compose.prod.yaml.example compose.prod.yaml` (or
     equivalent prod overlay).
  3. Edit `compose.prod.yaml` to enable the `caddy` service with
     `primitivehub.ai` as the upstream cert hostname.
  4. `docker compose -f compose.yaml -f compose.prod.yaml up -d caddy`
- **Verify:** `curl -I https://localhost:443 -H "Host: primitivehub.ai" --resolve primitivehub.ai:443:127.0.0.1` returns
  the web service's HTTP response (200 / 302) with valid cert.
- **Rollback:** `docker compose stop caddy && docker compose rm -f caddy`.
- **Approval:** explicit user OK after the verify curl succeeds.

### Step 2.2 — Sigstore backend flip (sigstage → fulcio.sigstore.dev)

- **Goal:** the api container signs against the public Sigstore
  (Fulcio + Rekor), not sigstage.
- **Action:** edit `apps/api/.env.prod` (or wherever
  SIGSTORE_BACKEND lives) to set `SIGSTORE_BACKEND=public-fulcio`.
  Then `docker compose restart api api-worker`.
- **Verify:**
  1. `docker compose logs api | grep "SIGSTORE_BACKEND"` shows the
     new value.
  2. The signing roundtrip from Step 0.4 against the public Sigstore.
- **Rollback:** revert the env value; `docker compose restart api api-worker`.
- **Approval:** explicit user OK after roundtrip success.

### Step 2.3 — Remove noindex defenses

- **Goal:** the registry web app is indexable by search engines
  AND the X-Robots-Tag response header no longer asserts noindex.
- **Action:**
  1. Edit `apps/web/app/robots.ts` to set
     `{ rules: { allow: "/", disallow: "" } }`.
  2. Edit `apps/web/middleware.ts` (or the X-Robots-Tag emitter)
     to drop the noindex header.
  3. Edit `apps/web/app/layout.tsx` to drop the `<meta name="robots" content="noindex,nofollow">` tag.
  4. `docker compose -f compose.yaml -f compose.prod.yaml build web && docker compose up -d web`.
- **Verify:**
  1. `curl -I https://primitivehub.ai/robots.txt` returns the
     allow-all rule.
  2. `curl -I https://primitivehub.ai/` shows no `X-Robots-Tag:
     noindex` header.
  3. `curl https://primitivehub.ai/` HTML body has no
     `<meta name="robots" content="noindex,nofollow">`.
- **Rollback:** revert the three files; rebuild + restart web.
- **Approval:** explicit user OK after all three verifies succeed.

### Step 2.4 — Publish DNS

- **Goal:** primitivehub.ai resolves publicly to the Hetzner IP.
- **Action:** in the DNS provider's UI, SAVE the A / AAAA records
  drafted in Step 1.3.
- **Verify:**
  1. `dig primitivehub.ai A` returns the Hetzner IP (give the
     DNS a propagation window of 60-300 seconds).
  2. `curl -I https://primitivehub.ai/` from a machine NOT on
     the host's network returns the web service response with
     valid TLS.
- **Rollback:** in the DNS provider's UI, delete the A / AAAA
  records. Propagation takes the TTL window.
- **Approval:** explicit user OK after the off-host curl
  succeeds.

### Step 2.5 — Run the launch-state pre-launch script in INVERSE mode

- **Goal:** verify the six layers are now in the launch-state
  (public on port 443, sigstore public, indexable). The
  `check-pre-launch-posture.sh` script can be re-run with a
  `--launch-state` flag (TBD — add in Round 9) to assert the
  inverse posture.
- **Action:** `scripts/check-launch-posture.sh` (NEW script for v0.2 of this runbook).
- **Verify:** every layer reports the LAUNCH-STATE value.
- **Rollback:** revert to the pre-launch-snapshot-NNNNNN tag.
- **Approval:** explicit user OK after script passes.

## Phase 3 — Communication (T plus 0h)

### Step 3.1 — arXiv submission

- **Goal:** the paper goes live on arXiv.
- **Action:** upload `paper/main.tex` + `paper/sections/` + `paper/references.bib` + any generated PDF figures via the arXiv web UI.
- **Verify:** arXiv assigns a paper ID; the abstract renders
  correctly; the PDF is generated by arXiv's pipeline.
- **Rollback:** withdraw the paper via arXiv UI (the paper stays
  in arXiv's history but is marked withdrawn).
- **Approval:** explicit user OK after the abstract preview
  looks correct.

### Step 3.2 — Pin the paper to the project README

- **Goal:** the repo README links the arXiv paper at the top of
  the file.
- **Action:** edit `README.md` to add a `[![arXiv](https://img.shields.io/badge/arXiv-NNNN.NNNNN-b31b1b.svg)](https://arxiv.org/abs/NNNN.NNNNN)` badge at the top. Commit + push to main.
- **Verify:** badge renders on GitHub.
- **Rollback:** revert the README commit.
- **Approval:** explicit user OK after seeing the badge.

### Step 3.3 — Social posts (gated)

- **Goal:** the launch is announced on the operator's chosen
  channels.
- **Action:** post drafts are in `docs/launch-announcements/`
  (TBD — author in Round 9). DO NOT auto-send. Operator copies
  each draft into the channel UI manually.
- **Verify:** post appears in the channel; replies are monitored.
- **Rollback:** delete the post (some channels allow edit/delete;
  some do not — see the channel's policy).
- **Approval:** explicit user OK for EACH channel post separately.

## Phase 4 — Post-launch monitoring (T plus 24h)

### Step 4.1 — Verify uptime + TLS expiry

- **Goal:** the registry is reachable AND the cert is auto-renewing.
- **Action:** check the Uptime Kuma instance (or whatever
  monitoring layer was set up); inspect TLS cert expiry.
- **Verify:** uptime > 99%; cert valid for > 60 days; no
  high-volume error logs.
- **Rollback:** n/a — this is a monitoring step.
- **Approval:** N/A.

### Step 4.2 — Verify Sigstore Rekor public log entries

- **Goal:** primitives signed in the public registry appear in
  the public Rekor transparency log.
- **Action:** `curl https://rekor.sigstore.dev/api/v1/log/entries?logIndex=N` for a known-signed primitive (test sample published at launch).
- **Verify:** entry exists; subject identity matches.
- **Rollback:** n/a (Rekor entries are append-only).
- **Approval:** N/A.

### Step 4.3 — Watch SECURITY.md for reports

- **Goal:** triage any FN/FP/vulnerability reports that arrive in
  the first 24 hours.
- **Action:** monitor `security@primitivehub.ai`; triage per the
  SECURITY.md routing table.
- **Verify:** every report routed; no report unacknowledged > 24h.
- **Rollback:** n/a.
- **Approval:** N/A.

## Rollback master procedure

If at ANY point in Phases 2 or 3 the operator decides to abort:

1. **Step R.1 — Revert DNS.** Delete the A/AAAA records in the
   provider UI; wait for TTL propagation.
2. **Step R.2 — Restore noindex defenses.** Revert the three
   edits from Step 2.3; rebuild + restart web.
3. **Step R.3 — Restore sigstage backend.** Revert the env value
   from Step 2.2; restart api + api-worker.
4. **Step R.4 — Restore localhost-only TLS termination.**
   `docker compose stop caddy && docker compose rm -f caddy`.
5. **Step R.5 — Re-run pre-launch posture check.**
   `scripts/check-pre-launch-posture.sh` — verify all six layers
   are back to the pre-launch values.
6. **Step R.6 — Withdraw arXiv paper.** If the abstract was
   already submitted, mark it withdrawn via the arXiv UI.

The rollback should take < 30 minutes if executed in order. The DNS
propagation is the longest single step; everything else is local
to the host.

## Decision log

- **2026-06-06 (Round 8 PR 8.2) — runbook v0.1 authored.** Four
  phases, master rollback procedure, every step gated on user
  approval. Three TBDs marked for v0.2:
    * `scripts/check-launch-posture.sh` (inverse of pre-launch).
    * `compose.prod.yaml.example` (concrete Caddy + prod overlay).
    * `docs/launch-announcements/` (post drafts for social channels).
  These ship in the round AFTER paper prose is publication-ready,
  which is the natural launch-prep window.

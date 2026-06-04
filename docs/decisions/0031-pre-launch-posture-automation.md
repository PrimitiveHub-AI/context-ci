# ADR-0031: Pre-launch posture automation — six-layer audit + Layer-1 CI gate

**Status:** Accepted
**Date:** 2026-06-02
**Related:** `docs/bugs.md` § 26 (the motivating incident),
`CLAUDE.md` hard-rule #3 (localhost-only),
`docs/principles.md` Principle 11 (pre-launch posture is absolute),
ADR-0025 (active surfaces — active-by-default is the posture this
discipline applies to *us*, not just to users).

## Context

On 2026-06-02 the production Next.js build served
`https://primitivehub.ai` and `https://www.primitivehub.ai` over public
HTTPS with a valid Let's Encrypt cert. The site was reachable to anyone
who knew the domain, four months before the coordinated arXiv launch.
Search-engine indexing was still blocked by `X-Robots-Tag: noindex`,
but the project's pre-launch secrecy invariant was already broken.

Root cause (see `docs/bugs.md` § 26 for the full incident report):
**"localhost-only" is a property of the whole network path, not any
single layer**. A correctly-configured compose port spec — which the
project DID have — is necessary but not sufficient. The leak took a
path the existing rule did not name:

1. Compose port specs (`compose*.yaml`) — already correct (`127.0.0.1:` prefix)
2. Direct process binds (`ss -tlnp`) — depends on running containers
3. Host services (nginx / caddy / traefik) — a host-level nginx config bound `0.0.0.0:80/443` and proxied to `127.0.0.1:3000`, making the compose-side correctness irrelevant
4. Public DNS (`dig`) — Cloudflare A records pointed `primitivehub.ai` + `www.primitivehub.ai` at the Hetzner host IP, including via the orange-cloud proxy
5. Firewall (`ufw status`) — no host firewall was active
6. Running-container state (`docker ps`) — containers created before the compose spec was fixed retained `0.0.0.0:` bindings; `docker compose up -d` does not re-create containers when only port specs change

Any one of layers 2–6 being unsafe is sufficient to expose the site,
regardless of the state of the others. The bug-#26 prevention notes
called out one specific layer-1 follow-up
(`scripts/check-port-bindings.sh`) as "proposed, separate follow-up PR";
this ADR generalises that to all six layers and lands the full
automation surface.

## Decision

### 1. Adopt a six-layer audit script

Ship `scripts/check-pre-launch-posture.sh` that walks every layer the
bug-#26 incident proved can independently violate the localhost-only
invariant:

| Layer | Check | Tool | Safe value |
|---|---|---|---|
| 1 | compose port specs carry host-IP prefix | grep / awk on `compose*.yaml` | every spec has ≥ 2 colons |
| 2 | no public listeners on web ports | `ss -tlnH` filtered to 80/443/3000/8000/9000 | no 0.0.0.0/:: rows |
| 3 | no active reverse proxies on the host | `systemctl is-active` × {nginx, apache2, caddy, traefik, haproxy, cloudflared} | every probe inactive |
| 4 | no public DNS records for the domain | `dig +short` against `primitivehub.ai` + `www.primitivehub.ai` (A + AAAA) | every query returns empty |
| 5 | host firewall is active | `ufw status` | `Status: active` |
| 6 | no docker containers expose 0.0.0.0/:: | `docker ps --format` | every binding starts with `127.0.0.1:` |

The script is a SINGLE entry point with three modes:

- **default**: run all six layers (designed for the live host).
- **`--ci`**: run layer 1 only (designed for GitHub Actions, which has the repo but not the host).
- **`--layer N`**: run a single layer (1..6) for targeted debugging.

Each layer emits one line of the form
`[ok|fail|skip] layer-N <name>: <detail>` — human-readable AND
machine-parseable. Layers gracefully `skip` when the required tool
isn't present (e.g., `ss` not installed in a stripped-down container),
so the script runs cleanly across CI runners, dev hosts, and the
production VM.

### 2. Layer-1 gate in CI on every PR

`.github/workflows/pre-launch-posture.yml` runs
`scripts/check-pre-launch-posture.sh --ci` on every push to main, every
PR against main, and via `workflow_dispatch`. Path filter scopes the
job to `compose*.yaml` and `scripts/` so it doesn't run on unrelated
changes. The job exits non-zero on any layer-1 violation, blocking
the merge.

CI cannot check layers 2–6 because GitHub Actions runners are
ephemeral and have no access to the production Hetzner host. Those
layers are checked operationally (see § 3 below).

### 3. Operational discipline for layers 2–6

Layers 2–6 are checked **on the host**, not in CI. Two integration
points:

1. **Pre-deploy hook**: any change that requires a `docker compose up`
   or a service restart MUST be preceded by running the full
   `scripts/check-pre-launch-posture.sh` on the host. The script's exit
   code is the go/no-go signal. Failing layers MUST be remediated
   before the deploy proceeds.
2. **Nightly heartbeat (operator-side, not in this repo)**: a cron
   entry on the production host runs the full audit and posts the
   line-by-line verdict to the operator's notification channel
   (Slack/Discord/email). This catches operational drift — a
   reinstalled nginx, a re-added DNS record, a new container that
   accidentally inherits a `0.0.0.0:` binding from a forgotten
   `--publish` flag. The webhook URL + cron schedule live outside the
   repo (operator infrastructure, not code).

Operators that copy the cron pattern from this ADR should treat the
absence of a heartbeat as a failure signal — silence is a layer-7
incident (the audit itself stopped running).

### 4. The localhost-only rule generalises

The existing `feedback-localhost-only` memory and `CLAUDE.md` hard-rule
#3 talked about "compose port specs" + "direct process binds." This
ADR formalises that the rule covers **six layers, not two**, with the
operational checklist above. Future tooling under
[Principle 19](../principles.md) (active by default) treats each layer
as a target the automation MUST discover — not one the operator MUST
remember.

## Alternatives considered

1. **Ship only `scripts/check-port-bindings.sh` (layer 1 only).**
   Rejected. The bug-#26 incident was caused by layers 2, 3, and 6 —
   layer 1 was already correct. A layer-1-only fix would not have
   prevented the incident. The five operational layers need their
   automation surface too.

2. **External monitoring service** (UptimeRobot, StatusCake, BetterStack)
   probing the domain from the public internet to detect leaks.
   Rejected for v0.1. Pre-launch, the project intentionally has no
   public surface for those probes to confirm; "the site is up" being
   the *unsafe* state inverts the usual monitoring semantics, and the
   third-party service becomes a vendor-lock-in surface before launch.
   A post-launch monitoring story is a different ADR.

3. **Defer until after the active-surfaces arc.** Rejected. Bug #26
   *just happened*; the gap is concrete and the prevention is cheap.
   Deferring the fix while the gap is fresh is the move that turns
   "we noticed and fixed it" into "we noticed and forgot to prevent
   the recurrence." The cost asymmetry favours doing this now.

4. **Block deploys via a Git pre-push hook on the host.** Rejected as
   the primary mechanism. Pre-push hooks live on the operator's
   workstation, not in the repo, and aren't version-controlled. A CI
   gate is the canonical enforcement surface for in-repo concerns.
   The host-side cron is the canonical enforcement surface for the
   operational layers. Pre-push hooks are an opt-in convenience the
   operator can add on top.

5. **Strict mode that fails on `skip` verdicts.** Rejected for v0.1.
   The script intentionally `skip`s layers whose tooling isn't
   present (e.g., `ufw` not installed on a CI runner) so it runs
   cleanly in multiple environments. A future flag (`--strict-skip`)
   could turn `skip` into `fail`; for now, the operator reads the
   skip lines and decides whether the missing tooling itself is the
   gap to close.

## Consequences

### Positive

- **Recurrence-proof at the in-repo layer.** A future PR that
  introduces a port spec like `- "3000:3000"` (no host-IP prefix)
  fails CI before it can be merged. The class of error that caused
  bug #26's layer-1 component is now structurally blocked.
- **Operational drift detected within 24 hours.** The nightly cron
  catches a reinstalled nginx, a re-added Cloudflare A record, or a
  stale container binding before it accumulates a week of public
  exposure.
- **Single command answers "is the project pre-launch-safe?"**
  Operators run `scripts/check-pre-launch-posture.sh` and get a
  line-by-line verdict. No memorising six different `dig`/`ss`/`ufw`
  invocations.
- **Discipline traceable in docs.** The methodology (this ADR) +
  motivation (`docs/bugs.md` § 26) + tooling (the script) +
  enforcement (the GHA workflow) form a closed loop. Future
  contributors don't have to rederive the lesson.

### Negative

- **The script's correctness depends on tool availability.** A host
  missing `dig` or `ss` returns `skip` instead of `fail`, masking
  layers that should be checked. Mitigation: the verdict line is
  visible (`[skip] layer-N`), and the operator notes any unexpected
  skips. Future hardening could add a `--strict-skip` mode.
- **No protection against zero-day operational paths.** If a new
  attack vector for accidental exposure appears — say, a Caddy
  module or a Docker network policy quirk — the script doesn't know
  about it. Mitigation: the script's layers are documented and
  extensible; new layers are added under the same ADR-versioning
  rule as everything else.
- **Layer 5 (ufw) requires sudo on most hosts.** The script handles
  this by trying `sudo -n` (no-prompt) and gracefully skipping if
  sudo is unavailable. Operators who want layer-5 enforcement run
  the cron under root.

### Neutral

- **The cron + webhook live outside the repo.** They're operator
  infrastructure (host crontab + secret webhook URL), not code.
  This ADR documents the pattern; the operator owns the
  implementation. Future ADR may move to a sidecar container or a
  systemd timer if the cron pattern needs to be reproducible across
  multiple hosts.

## Implementation

- `scripts/check-port-bindings.sh` — layer-1-only check, in-repo,
  callable both directly and as the layer-1 implementation of the
  six-layer script. Exit codes: 0 safe / 1 unsafe / 2 no compose
  files found.
- `scripts/check-pre-launch-posture.sh` — six-layer audit; modes:
  default (all layers) / `--ci` (layer 1 only) / `--layer N`
  (single layer). Exit codes: 0 safe / 1 unsafe / 2 usage error.
- `.github/workflows/pre-launch-posture.yml` — CI gate running
  layer 1 on every PR + push to main + workflow_dispatch.

## What ships in subsequent PRs

- **Operator-side cron + webhook integration** — runs the full audit
  nightly; lives outside the repo per § 3. Documentation lands in
  `docs/operations.md` when that file is created.
- **`--strict-skip` mode** if the project standardises on a base host
  image with a guaranteed tool set.
- **Layer 7+** as new attack vectors for accidental exposure are
  identified.

## References

- `docs/bugs.md` § 26 — the motivating incident
- `CLAUDE.md` hard-rule #3 — localhost-only (updated to reference
  this ADR)
- `docs/principles.md` Principle 11 — pre-launch posture is absolute
- `docs/principles.md` Principle 19 — active by default (the
  six-layer audit IS active discovery applied to the project's own
  posture)
- ADR-0025 — Active surfaces (parallel philosophy applied to user
  projects)
- `scripts/check-port-bindings.sh`, `scripts/check-pre-launch-posture.sh`,
  `.github/workflows/pre-launch-posture.yml` — the implementation

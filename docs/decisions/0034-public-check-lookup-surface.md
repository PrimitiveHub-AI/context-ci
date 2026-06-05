# ADR-0034: Public `/check` lookup surface — paste-and-verdict for any agent-context artifact

**Status:** Accepted
**Date:** 2026-06-04
**Related:** ADR-0013 (Trust API by-digest lookup), ADR-0016 (Top 10
versioning), ADR-0018 (Context Policy Language v0.1), ADR-0023 (phub
CLI + detector parity), ADR-0025 (active surfaces + `phub audit`),
ADR-0030 (FP resolution + AV-vendor parallel), `docs/threat-model.md`,
`docs/positioning.md` § "Product-family parallel."

## Context

ADR-0030 § 3 names the AV-product-family parallel as load-bearing
strategy and maps every PrimitiveHub surface to its AV-product
equivalent. One row in that table is **"Cloud lookup / reputation
service"**, currently satisfied by the Trust API by-digest lookup
(ADR-0013). That endpoint takes a SHA-256 and returns the
attestation if one exists.

That's the answer for **content we already know about**. It does not
answer the four highest-volume daily-use questions a practitioner
brings to a defense vendor:

1. *"Someone DM'd me this skill. Is it safe before I add it to my
   repo?"* — they have raw bytes, no provenance, no digest in our
   index.
2. *"This npx command is in a tutorial. Should I trust it?"* — they
   have a package coordinate, not a file.
3. *"This URL is in our internal wiki as a CLAUDE.md to copy. Is it
   poisoned?"* — they have a remote pointer.
4. *"My CI pipeline failed on a skill in our monorepo. Why?"* — they
   have a path on a machine they own and need a second opinion.

The CLI (`phub audit`, `phub scan`) answers (4) locally. The Trust
API by-digest lookup answers nothing in this list — by the time you
have a digest, you've already decided to engage with the content.

The browser is where the first three live. VirusTotal proved this for
binaries 20 years ago: a public, zero-install lookup surface
accelerates adoption faster than any registry feature, because every
defender who finds a suspicious sample first reaches for *paste-and-
verdict*. The same reflex applies to agent context, and no competitor
ships this surface today.

This ADR locks the decision to build it.

## Decision

### 1. Ship `/check` as a public, anonymous, browser-accessible lookup surface

URL: `https://primitivehub.ai/check` (pre-launch: localhost-only per
[`docs/bugs.md` § 26](../bugs.md) + `feedback-localhost-only`).

Three input modes — the daily-use frame from § Context above:

- **Content paste.** User pastes raw text (a skill `.md`, a
  `CLAUDE.md`, a `.cursorrules`, an MCP `config.json`, a prompt
  fragment). Scanned directly against the Context CI Top 10 (CCI-001
  through CCI-010). No fetch, no execution, no network.
- **URL paste.** User pastes a `https://` URL. The server fetches it
  under strict controls (§ 2 below) and scans the response body.
- **npx paste.** User pastes an `npx @scope/name@version` (or
  `npm install @scope/name@version`) coordinate. The server resolves
  it against the npm registry, fetches the **tarball**, unpacks it
  in memory, and scans **every scannable file** statically. The
  package is **never executed.**

Output is a single verdict page: deterministic trust score, severity
badge, per-detector findings with line numbers and diff hints,
fetched-artifact metadata (file count, total bytes, registry
URL, resolved version).

### 2. The npx path is static analysis, not sandboxed execution

This is the most important sub-decision in the ADR because it is the
sub-decision that *makes the npx surface shippable*. Reject the
obvious framing — "spin up a container, run `npx`, observe what it
does" — explicitly. The AV-vendor parallel (ADR-0030 § 3) is precise
here: AV scanners do not detonate the binary, they read its bytes.

Concrete contract:

1. Parse the coordinate to `(scope?, name, version-spec)`. Reject any
   coordinate that doesn't match
   `[@scope/]name[@semver]`. Reject coordinates that don't resolve to
   `registry.npmjs.org` (no custom registries in v1 — locked).
2. Resolve `version-spec` against `https://registry.npmjs.org/<name>`
   metadata. If a range, pick the latest published version that
   matches. Record the resolved version in the response.
3. HTTPS-GET the tarball URL exactly as it appears in the registry
   metadata's `dist.tarball`. Verify the response `integrity` /
   `shasum` field against the bytes received. **If integrity fails,
   abort with `T5:integrity-mismatch`.**
4. Decompress + untar in a stream with hard caps. Two profiles —
   npm tarballs are typically small (an npm publish over 8 MiB is a
   smell), but real GitHub skill collections regularly exceed that.
   The npm path enforces the tighter caps; the GitHub path uses the
   larger ones:

   | Cap | npm (npx mode) | GitHub (github mode) |
   |---|---|---|
   | Max compressed | 8 MiB | 32 MiB |
   | Max uncompressed total | 128 MiB | 256 MiB |
   | Max entry count | 4 000 | 20 000 |
   | Max per-entry uncompressed | 8 MiB | 8 MiB |
   | Wall-clock budget | 30 s | 30 s |

   - Entry name sanitization: reject absolute paths, `..`, symlinks,
     hardlinks, non-regular-file entries. (Tarball-bomb defense +
     path-traversal defense.)
   - Larger → abort with a named error so the user knows what
     happened. The caps are deliberate — an attacker can't make us
     OOM, but legitimate skill collections fit. Caps revisited
     2026-06-04 after real-world pastes hit the original 8 MiB
     compressed limit on collections like `anthropic-cybersecurity-
     skills`.
5. For each unpacked file, classify it via the same
   `audit/classifier` rules already shipped (ADR-0025) and run T1–T10
   detectors against every classified-as-scannable file. Files
   classified as binary, lockfile-only, or generated are skipped from
   the detector run but still listed in the response.
6. Return aggregate verdicts + per-file verdicts. **At no point is
   any code in the package executed.** No `postinstall` script ever
   fires. No `require()` of any package file. The package is treated
   exactly like a file uploaded for AV scanning.

This contract is what ADR-0030 § 2 (sub-bullet 4) had in mind when it
rejected "Cloud-lookup gating ('call home before allowing')" — that
rejection is about *enforcement*, not about *voluntary inspection*.
`/check` is the voluntary-inspection surface. The user came to us; we
did not interpose ourselves on their install path. Honored.

### 3. The URL path is fetch-with-strict-allowlist

Concrete contract:

1. Scheme MUST be `https`. `http`, `file`, `data`, `ftp`, `gopher`,
   `javascript`, `chrome-extension`, etc. — all rejected.
2. Hostname resolution: reject if any resolved IP is in
   `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`,
   `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`, or `0.0.0.0`.
   This is the standard SSRF defense — we are not the
   `/check` user's gateway into their internal network.
3. Max response size: 8 MiB. Larger → abort.
4. Max wall-clock: 10s. Slower → abort.
5. Follow at most 3 redirects, and each redirect target re-runs steps
   1–2. (Open-redirect-into-internal defense.)
6. Content-Type is informational only — we scan the bytes regardless.
   A `text/plain` URL that returns malicious markdown still gets
   the full Top 10 treatment.

### 4. The trust score is deterministic, not heuristic

Per `feedback-no-fake-numbers` and `docs/brand-voice.md`, the score
emitted on the verdict page MUST be reproducible from the verdict
shape alone. The formula is:

```
score = max(0, 100 - 25 * count(FAIL) - 10 * count(WARN))
```

- 90–100 → `CLEAN` (green)
- 70–89 → `CAUTION` (light amber)
- 40–69 → `SUSPICIOUS` (amber)
- 0–39 → `HIGH RISK` (red)

This is the *only* aggregate number the surface emits. There is no
"reputation score," no "community trust signal," no ML-classifier
confidence. The score is a thin pivot over the same `Verdict[]` shape
the registry pipeline already commits to (ADR-0023). If two
practitioners paste the same content, they get the same score,
deterministically. The score formula ships as part of `docs/spec.md`
in v0.2 so it's audit-citable.

### 5. The surface is anonymous; not gated by login

A user pasting a sketchy skill to ask "is this safe?" should not have
to create an account first. The AV-vendor parallel is exact: every
on-demand AV scanner that AV vendors ship lets you scan a file
without an account. Login defeats the surface's job.

Abuse control:

- Per-IP rate limit: 30 requests / 5-minute window (in-memory cache
  via Valkey, same as the existing throttler).
- Per-IP daily ceiling: 500 requests / 24-hour window.
- Max payload size at the HTTP layer: 1 MiB for `content` mode.
- All limits are returned via standard `Retry-After` + `X-RateLimit-*`
  headers; the frontend renders an informative "you've hit the
  ceiling, come back in N minutes" panel instead of a raw 429.

We do not log the pasted content. We log the request metadata
(timestamp, mode, IP-hash, response-class, latency, score) for
operational telemetry. Pasted bytes are scanned and dropped; the
verdict response body does NOT contain the original content beyond
the truncated `DiffHint.snippet` fields that the detector already
produces (≤120 chars per hint, max 10 hints per detector — same caps
already shipped in ADR-0023). This is the right privacy posture for a
public scanner: if a user pastes a credential to ask if a skill is
exfiltrating credentials, we don't want our logs to be the next
exfiltration vector.

### 6. The Python detector set is the canonical implementation; TS detector parity (ADR-0023) is a separate concern from this surface

The `/check` endpoint runs the Python `get_all_detectors()` set
(`apps/api/scanners/registry.py`). The TS port in
`packages/phub/src/scanners/` is unchanged by this ADR. Cross-language
parity continues to be enforced by the shared fixture corpus
(ADR-0023 + ADR-0032) — `/check` is just one more consumer of the
Python detectors.

## Alternatives considered

1. **Don't build the surface; rely on the CLI.** Rejected. The CLI
   answers question (4) only. Questions (1)–(3) are the high-volume
   daily-use questions and the surface where category awareness is
   built. VirusTotal-as-acquisition is the closest analogy; we leave
   the same surface unbuilt at our peril.

2. **Run `npx` inside a sandboxed container, observe behavior, return
   the trace.** Rejected per § 2. The attack surface of "execute
   arbitrary npm packages a user can name" is too large for a public
   anonymous surface to operate safely. AV scanners learned this 25
   years ago — static analysis first, dynamic analysis only inside a
   contracted enterprise tier (which is a future surface, not this
   one).

3. **Require login.** Rejected per § 5. Defeats the daily-use frame.
   The user who needs the answer hardest is the one with the least
   patience for an account flow.

4. **Implement detectors in the Next.js route handler via the TS
   `@primitivehub/phub` package.** Rejected for this surface.
   Architectural reason: the npm/tarball-fetch path is more
   naturally Python (`tarfile`, `urllib`, stdlib-only) and the
   Python detector pipeline is the same one the registry's signing
   pipeline uses (ADR-0023 § "lockstep parity, but Python is the
   reference"). Building a parallel TS execution path here would
   re-derive what we already have. The Next.js page is a thin client;
   the Django endpoint does the work.

5. **Persist every scanned blob to S3/R2 for future re-scanning.**
   Rejected for v1. Privacy posture in § 5 is stronger if we never
   write the bytes. A future "submit sample for community"
   surface is a different ADR.

6. **Emit a 5-star "community trust" rating.** Rejected per § 4
   + `feedback-no-fake-numbers`. There is no community signal in
   `/check` v1; inventing one would be a fake number.

## Consequences

### Positive

- **One-line answer to "what does PrimitiveHub do for me right
  now?"** — *"Paste any AI skill, URL, or `npx` command into
  primitivehub.ai/check; we tell you if it's safe before you run
  it."* The category-explainer surface ADR-0030 needs.
- **No-account adoption funnel.** A user who pastes a sketchy
  skill and gets back an FAIL verdict has the highest possible
  motivation to read the surrounding product. VirusTotal pattern.
- **Closes the AV-product-family table.** ADR-0030 § 3 has the row
  *"Cloud lookup / reputation service"* attached to ADR-0013 (Trust
  API by-digest lookup). This ADR upgrades that row from
  *"digest-only, programmatic"* to *"paste-anything, browser"*.
- **Detectors get exercised by real-world content.** Every paste is
  a free data point on detector precision/recall (per ADR-0032's
  corpus measurement). We don't store the bytes, but the verdict
  metadata (which detectors fired on what mode) flows into the
  corpus prioritization queue.
- **Pre-existing primitives compose.** `audit/classifier`,
  `audit/walker`, `scanners/registry`, `scanners/types` all reused
  unchanged. The new code surface is small.

### Negative

- **SSRF surface.** Every URL-fetch endpoint expands the attacker
  surface. § 3 mitigates by HTTPS-only, IP allowlist, response
  caps, redirect caps. The mitigations are standard but the surface
  exists.
- **Tarball-bomb surface.** § 2 caps mitigate but a determined
  attacker will probe limits. Mitigations are conservative; we tune
  on telemetry.
- **Public lookup means public abuse vector.** A determined
  attacker can use `/check` as an oracle to see which patterns the
  detectors catch. This is the same trade-off every AV-vendor
  on-demand scanner has accepted for 30 years. Acceptable.
- **Pre-launch posture means the surface is not actually reachable
  by the public until Phase 10.** All work lands behind the
  localhost-only binding rule. The benefit is realized at launch.

### Neutral

- The surface is read-only and stateless. No database tables, no
  migrations, no Procrastinate task. (One Valkey key per
  rate-limit window, evicted automatically.)
- Failure modes (rate limit hit, tarball too large, URL refused) are
  surfaced as named error codes in the response payload, not as
  500s — the frontend renders them as informative panels.

## Implementation

Landing in this PR:

- New Django app `apps/api/checks/`:
  - `apps.py` — AppConfig.
  - `api.py` — Ninja router; `POST /check`; anonymous;
    rate-limit decorated.
  - `scan.py` — orchestrates `get_all_detectors()` over input bytes.
  - `npx_resolver.py` — `parse_npx`, `resolve_version`,
    `fetch_tarball`, `extract_safely`.
  - `url_fetcher.py` — `fetch_url` with SSRF + size + redirect
    guards.
  - `tests/test_api.py`, `tests/test_npx_resolver.py`,
    `tests/test_url_fetcher.py`.
- `apps/api/primitivehub_api/api.py` — register `checks_router`.
- `apps/api/primitivehub_api/settings.py` — `checks` added to
  `INSTALLED_APPS`.
- New Next.js page `apps/web/app/check/`:
  - `page.tsx` — three-tab paste UI.
  - `components/check-form.tsx` — input + submit.
  - `components/check-verdict.tsx` — verdict render.
- Navbar gets a `Check` link.

Landing in follow-ups:

- Persisted scan history for authenticated users (`/check/history`).
- Share-verdict permalinks (digest-keyed).
- npm registry mirror configuration for air-gapped enterprise
  installs.
- Custom registry support beyond `registry.npmjs.org`.
- Multi-package coordinates (e.g. `npm install pkg1 pkg2`).
- HuggingFace / GitHub raw-file coordinates as additional resolver
  types.

## Strategic implications

`/check` is the **public face of the AV-product-family parallel.**
Every other surface (CLI, registry, signing pipeline, MCP gate) is
visible only to engineers who have already adopted the workflow.
`/check` is visible to anyone with a browser and a sketchy skill.
The first time a CISO encounters PrimitiveHub will be either through
the paper or through `/check`. Make sure the second one delivers the
category in the first 30 seconds.

When a customer asks *"how is this different from a GitHub readme that
lists skill libraries?"* — the answer is to paste a malicious skill
into `/check` and into a GitHub readme search bar, side by side. The
demo is the positioning.

## References

- ADR-0013 — Trust API by-digest lookup (the same product-family row,
  programmatic predecessor)
- ADR-0016 — Top 10 versioning + stable IDs (the taxonomy `/check`
  scores against)
- ADR-0018 — Context Policy Language v0.1 (mechanism `/check` does
  NOT apply — `/check` is verdict-only, not policy-gated)
- ADR-0023 — phub CLI + detector parity (the Python detector set
  `/check` runs)
- ADR-0025 — Active surfaces + `phub audit` (the
  classifier `/check` reuses)
- ADR-0030 — FP-resolution + AV-vendor parallel (the strategic
  framing `/check` realizes for browser users)
- ADR-0032 — Adversarial corpus + cross-language detector
  measurement (the precision/recall regime `/check` feeds into)
- `docs/false-positive-resolution.md` — FP discipline; `/check`
  verdicts can be challenged via the same ledger if a false-positive
  is reported through a future FP-submission surface
- `docs/threat-model.md` — the Top 10 categories `/check` scores
  against
- `docs/positioning.md` § "Product-family parallel" — the
  category-framing this surface realizes for end users

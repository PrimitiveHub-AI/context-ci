# ADR-0028: `phub install` — safe-install for context primitives

**Status:** Accepted
**Date:** 2026-06-02
**Related:** ADR-0015 (Trust Contract versioning), ADR-0016 (Top 10),
ADR-0018 (Context Policy), ADR-0020 (verify as reference impl),
ADR-0023 (phub CLI + detector parity), ADR-0025 (active surfaces +
phub audit), ADR-0026 (phub.lock + drift), ADR-0027 (phub watch),
ADR-0029 (MCP runtime gate), ADR-0030 (FP resolution + AV-vendor
parallel), ADR-0031 (mcp-server as transport),
`packages/phub/src/commands/install.ts`,
`packages/phub/src/install/`

## Context

The T5 attack class (Shai-Hulud) is operational shorthand for
"a primitive instructs an AI agent to fetch + execute code from the
network without verification": `curl ... | bash`, `npx <evil-pkg>`,
`pip install <url>`, `bash <(curl ...)`. The detector flags the
*pattern* (ADR-0023); ADR-0030 § 3 places the *operational
mitigation* — a "safe installer" — as the **package manager row** of
the AV product-family map.

After ADR-0025–0027 + ADR-0029, four of the five active surfaces
ship: audit (point-in-time), lock (boot-time), watch (run-time),
runtime gate (read-time). The fifth slot — `phub install` — is what
closes the arc and what makes the lock's `registry:<slug>@<semver>`
attestation state meaningful (it's `unattested` for every artifact
today; only install can populate the real provenance string).

The strategic punchline: `npx evil-skill@latest` becomes
`phub install evil-skill@latest`. The installer fetches the Trust
Bundle, verifies it cryptographically, writes the content to a
deterministic on-disk location, and records the install in the lock
with `attestation: "registry:<slug>@<semver>"`. The runtime gate
(`verify_before_load`, ADR-0029) then accepts the file because the
lock entry proves provenance.

## Decision

### 1. Three source modes — `<slug@semver>` / `--bundle` / `--url`

| Source | Use case | Lock `attestation` |
|---|---|---|
| `phub install foo@1.0.0` | The default: fetch from a registry | `registry:foo@1.0.0` |
| `phub install --bundle ./bundle.json` | Local file (CI artifact, teammate hand-off) | `local:<absolute path>` |
| `phub install --url https://...` | Direct URL (custom hosting, dev sandbox) | `url:<URL>` |

Mutually exclusive — passing more than one fails with `AMBIGUOUS_SOURCE`.
Passing none fails with `NO_SOURCE`. Both refusals are exit-code 2.

`--registry <base-url>` overrides the default registry
(`https://registry.primitivehub.ai`). Required pre-launch; defaults to
the public one post-launch.

### 2. Pipeline

```
1. classifySource(opts)                  → BundleSource (kind + attestation)
2. fetchBundleText(source)               → string                  (path read | fetch)
3. JSON.parse(text)                      → bundle                  (BUNDLE_PARSE_ERROR on fail)
4. verifyBundle(bundle, {level})         → VerificationResult      (BUNDLE_REJECTED on !valid)
5. planInstallTarget({workspaceRoot, …}) → InstallTarget           (safety rules — § 5)
6. writeBundleContent(bundle, target)    → bytes on disk           (ALREADY_INSTALLED unless --force)
7. updateLock(...)                       → updated .primitivehub/phub.lock
```

Every step has a stable failure code. CI consumers branch on the code,
not on the message:

| Code | Source step | Meaning |
|---|---|---|
| `NO_SOURCE` / `AMBIGUOUS_SOURCE` | 1 | Source classification refused |
| `INVALID_SLUG_SEMVER` / `UNSAFE_SLUG` / `INVALID_SEMVER` | 1 | Positional argument refused |
| `BUNDLE_NOT_FOUND` / `BUNDLE_READ_FAILED` | 2 | --bundle path issues |
| `FETCH_TIMEOUT` / `FETCH_FAILED` / `FETCH_HTTP_ERROR` / `FETCH_BODY_FAILED` | 2 | URL / registry fetch issues |
| `BUNDLE_PARSE_ERROR` | 3 | Response wasn't JSON |
| `BUNDLE_REJECTED` | 4 | Verify refused — message includes the verify codes |
| `EMPTY_CONTENT` / `DECODE_FAILED` / `CONTENT_TOO_LARGE` / `SIZE_MISMATCH` | 6 | Content extraction refused |
| `UNKNOWN_MEDIA_TYPE` / `UNSAFE_COMPONENT` / `PATH_TRAVERSAL` | 5 + 6 | Writer safety refused |
| `ALREADY_INSTALLED` | 6 | Install path exists; pass --force to overwrite |
| `LOCK_READ_FAILED` | 7 | Existing lock unparseable |

### 3. Path layout — `<workspace>/.primitivehub/installed/primitives/<slug>/<semver>/primitive.<ext>`

The `primitives/` segment isn't decorative — it's what makes the
existing audit classifier rule (`**/primitives/**/*.md`) match
installed artifacts, so re-audit discovers them and lock-drift
detection survives reinstall + edit attacks.

Two coordinated changes ship with this PR:

- **Install default `installRootRel = ".primitivehub/installed/primitives"`**
  (was `.primitivehub/installed` in early drafts; corrected once smoke
  testing revealed the classifier mismatch).
- **Walker `KEEP_DOT_DIRS` gains `.primitivehub`** so the audit walker
  descends into the installed/ tree on every audit. Without this fix,
  installed primitives were invisible to `phub audit` and the lock-
  comparison short-circuited to "no artifacts found."

### 4. Safety rules at the writer layer

The bundle's `subject.slug` is treated as untrusted user input even
when verified — the v0.1 verify library checks the *content* digest,
not the slug's safety properties. Writer-side defenses:

1. **Slug + semver must be path-safe.** No `..`, no leading `/`, no `\`.
   Re-validated even if the slug came through the CLI parser (defense
   in depth).
2. **Computed install path stays inside the workspace.** A
   `relative(installRoot, installPath)` that starts with `..` is a
   `PATH_TRAVERSAL` failure.
3. **Media type whitelist.** v0.1 emits `.md` for `text/markdown`,
   `.txt` for `text/plain`, `.json` for `application/json`. Unknown
   media types refuse with `UNKNOWN_MEDIA_TYPE` — sensitive because
   running `chmod +x` on an installed file would be a new attack
   class if we accepted `application/x-shellscript` here.
4. **16 MB content cap.** A v0.1 sanity bound on `Buffer.from(bytesB64)`
   length. Matches typical primitive sizes (markdown rarely exceeds a
   few hundred KB); v0.2 may make this configurable.
5. **`content.sizeBytes` cross-check.** When the bundle advertises a
   size, the decoded byte count MUST match.
6. **`--force` required to overwrite.** Default refuses
   `ALREADY_INSTALLED` rather than silently clobber. The right answer
   when an install already exists is usually "uninstall first" (a
   v0.2 candidate) or "version-bump and reinstall," not silent
   overwrite.

### 5. Lock attestation taxonomy widened

`LockAttestation` (in `audit/lock.ts`) gains two prefixes alongside
the existing `unattested` / `rekor:` / `registry:`:

- `url:<url>` — installed via `--url`. The lock records *where* the
  bundle came from; v0.2 may add `url:<url>#sha256:<digest>` for
  ledgers that prefer to inline the source hash.
- `local:<path>` — installed via `--bundle`. The lock records the
  absolute path of the source bundle file at install time. Useful for
  audit ("which CI artifact did this install come from?") even
  though the file may have been deleted since.

The discipline rule: **a CI-gated production project should reject
PRs that introduce `local:*` or `url:*` attestations.** Only
`registry:<slug>@<semver>` (and eventually `rekor:<log-index>`) should
land on main. `local:*` and `url:*` are dev-mode escape hatches.

### 6. Lock is updated by default — `--no-lock` opts out

Every install writes (or extends) `.primitivehub/phub.lock` by
default. The CLI accepts `--no-lock` for ephemeral installs (e.g.,
"try this primitive in a tmp dir, never commit anything"). Tests use
this flag to keep the workspace clean.

### 7. Verification level defaults to `policy`

`phub verify` defaults to `policy` (steps 1+2+7). `phub install`
matches that default for consistency. `--level full` is accepted but
returns the v0.1 `*_DEFERRED` codes when the bundle's Sigstore steps
are stubbed; v0.2 of the verify library (per ADR-0020) unstubs steps
3-6 and `--level full` becomes load-bearing automatically.

## Alternatives considered

1. **Default install path `.primitivehub/installed/<slug>/<semver>/...`**
   without the `primitives/` segment. Rejected after smoke testing —
   the audit classifier didn't match (no `**/primitives/**` segment)
   and installed artifacts were invisible to subsequent audits. Either
   add `primitives/` to the path OR change the classifier to special-
   case `.primitivehub/installed/`. The former is simpler + composable
   with future install destinations.

2. **Auto-route by classification** — `phub install` inspects the
   bundle's predicate, finds `agent-context-class: "claude-skill"`, and
   writes to `.claude/skills/<slug>.md`. Considered. Rejected for v0.1
   because (a) the Trust Bundle v0.1 spec doesn't have a stable
   "destination class" field, (b) writing to host-managed directories
   (`.claude/`, `.cursor/`) is intrusive — operators should opt in, and
   (c) the single-directory default makes uninstall and `--force`
   semantics simple. v0.2 may add `--route auto` once the spec
   supports it.

3. **Skip the writer + only update the lock** (treat `phub install` as
   "register a pre-existing artifact"). Rejected — the installer's
   whole job is to replace `npx | bash` operationally; without writing
   the content, agents would still have to fetch it some other way and
   the install command would be a manifest tool, not a safe-install
   command.

4. **Use a runtime dep** (`undici`, `node-fetch`, `axios`) instead of
   built-in `fetch`. Rejected. Node 20+ has built-in `fetch`; adding a
   dep here would mirror the discussion about chokidar in ADR-0027 —
   the built-in is sufficient + matches phub's zero-deps narrative
   (only `yaml` is a runtime dep today).

5. **Reject `local:` and `url:` attestations entirely** — only allow
   registry-installs. Rejected. The dev-mode use cases (test a CI
   artifact's bundle, install from a teammate's hand-off, install
   from a temporary sandbox) are real. The discipline is "don't merge
   policies / locks that contain these prefixes," documented in this
   ADR § 5 + the user docs.

6. **Bundled `--checksum sha256:...` flag** to short-circuit verify
   without parsing the whole bundle. Rejected. Verify is fast enough
   (< 10ms typical for the structural+policy path) that bypassing it
   would be premature optimization, and the lossy-bypass would
   undermine the "verified-before-write" promise.

## Consequences

### Positive

- **The active-surfaces arc is complete.** All five surfaces from
  ADR-0025 ship (audit, lock, watch, runtime gate, install). The
  AV product-family map's "package manager / safe installer" row
  from ADR-0030 § 3 is shipped.
- **`registry:<slug>@<semver>` attestation becomes real.** Until this
  ADR, the lock could only carry `unattested`. After this, the
  runtime gate's `requireAttestation: true` mode (ADR-0029 § 5)
  becomes meaningful in production.
- **The Shai-Hulud demo is concrete.** `npx evil-skill@latest`
  becomes `phub install evil-skill@latest` — same install ergonomics,
  cryptographic verify, lock entry, drift detection. The story
  doesn't depend on "trust me bro."
- **Composes cleanly with audit + watch.** Walker discovers installed
  primitives, audit policy-checks them, watch reacts to tampering,
  runtime gate refuses-by-default on drift.
- **Three sources cover dev-mode + CI + production** without needing
  three commands.

### Negative

- **One runtime dep** isn't added, but two new attestation prefixes
  (`url:`, `local:`) are minted. They're "dev-mode" escape hatches
  and must NOT land in committed locks for production. Documented
  but not mechanically enforced — a CI lint rule + the FP-style
  discipline from ADR-0030 should cover it.
- **Installed primitives are routed to a single directory.** Agents
  expecting `.claude/skills/foo.md` to "just work" after
  `phub install @scope/foo@1.0.0` will be surprised — the artifact
  lands in `.primitivehub/installed/primitives/@scope/foo/1.0.0/primitive.md`
  instead. v0.2 `--route auto` resolves this; v0.1 expects the
  consumer (agent runtime, MCP gate) to know to look under
  `.primitivehub/installed/`.
- **No uninstall command yet.** `phub uninstall <slug@semver>` is a
  v0.2 candidate. Today: delete the file, run `phub audit
  --update-lock`.
- **No `phub list installed` command yet.** Same v0.2 candidate.
  Today: `phub audit --json | jq '.artifacts[] | select(.path | startswith(".primitivehub/installed/"))'`.

### Neutral

- **The walker now descends into `.primitivehub/`.** Hidden, but
  meaningful. Every audit re-classifies installed primitives + lock-
  compares them, which is the right default. If a future feature
  needs a hidden directory the walker should ignore, the existing
  `SKIP_DIRS` mechanism is available.
- **`@primitivehub/verify` is a runtime dep of phub** already (via
  `file:` link in the monorepo, `^0.1.0` post-launch). `phub install`
  uses it for step 4 of the pipeline. No new runtime-dep surface.

## Implementation

`packages/phub/`:
- `src/install/source.ts` — `parseSlugSemver`, `classifySource`,
  `fetchBundleText`, `InstallSourceError` with stable codes.
- `src/install/writer.ts` — `planInstallTarget`,
  `writeBundleContent`, `InstallWriteError` with safety-rule codes.
- `src/commands/install.ts` — `installCommand(opts)` CLI dispatch +
  `runInstall(opts)` programmatic API.
- `src/audit/lock.ts` — `LockAttestation` widened to include
  `url:<string>` and `local:<string>`.
- `src/audit/walker.ts` — `KEEP_DOT_DIRS` gains `.primitivehub` so the
  installer's outputs are discoverable by re-audit.
- `src/cli.ts` — `case "install"`, `INSTALL_HELP`, flag specs for
  `--bundle`, `--url`, `--registry`, `--install-dir`, `--no-lock`,
  `--fetch-timeout-ms` (composes with the existing `--force`,
  `--lock-path`, `--level`, `--json`).
- `src/index.ts` — programmatic exports.
- `test/install.test.ts` — 22 cases:
  - 6 for `parseSlugSemver` (happy + path-traversal + missing parts)
  - 5 for `classifySource` (each kind + no-source + ambiguous)
  - 5 for `--bundle` source (happy, ALREADY_INSTALLED, --force, bundle
    rejected, --no-lock)
  - 4 for `--url` + slug@semver (using a local http server fixture):
    happy URL, happy registry, 404, HTML response
  - 2 for writer-direct safety (slug-with-`..`, unknown media type) —
    targeting the writer directly because verify rejects tampered
    bundles before the writer runs

200/200 phub tests after this PR (was 178). Walker change has zero
regression on audit / lock / watch / scan tests.

End-to-end smoke (manually):
- `phub install --bundle <valid-bundle.json>` → exit 0, file
  written to `<workspace>/.primitivehub/installed/primitives/<slug>/<semver>/primitive.md`,
  lock entry with `attestation: "local:<path>"`.
- `phub audit --check-lock` against the post-install workspace
  → exit 0, "1/1 artifacts clean. Lock match: no drift."

## What ships in subsequent PRs

- **`phub uninstall <slug@semver>`** — removes the file + lock entry
  cleanly. v0.2 candidate.
- **`phub list installed`** — pretty-prints installed primitives +
  their attestations.
- **`--route auto`** — once the Trust Bundle spec adds a stable
  "destination class" predicate field, the installer can place
  `claude-skill` bundles into `.claude/skills/` and so on.
- **Verify v0.2 cryptographic steps** — when ADR-0020's verify ratchets
  to v0.2 (Sigstore signature + cert + Rekor), `phub install --level
  full` becomes the production default. The `rekor:<log-index>`
  attestation prefix becomes meaningful.
- **Registry HTTP spec freeze** — a separate spec doc + ADR for the
  `<registry>/v1/registry/<slug>/<semver>` route shape, content
  negotiation, rate limits, error responses. Today the route is
  implicit; v0.2 makes it a real contract.
- **MCP `install_primitive` tool** — exposes `phub install` over MCP
  so agent runtimes can install verified primitives mid-task. Behind
  an explicit-consent gate per ADR-0031 § 2 rule #1 (no destructive
  agent actions without consent).

## References

- `packages/phub/src/commands/install.ts` — CLI dispatch + runInstall
- `packages/phub/src/install/source.ts` — source resolution + fetch
- `packages/phub/src/install/writer.ts` — content extraction + safety
- `packages/phub/test/install.test.ts` — conformance
- ADR-0015 — Trust Contract versioning
- ADR-0020 — verify as reference implementation
- ADR-0023 — phub CLI + detector parity
- ADR-0025 — active surfaces + phub audit (the arc this ADR closes)
- ADR-0026 — phub.lock + drift (consumes new attestation prefixes)
- ADR-0027 — phub watch
- ADR-0029 — MCP runtime gate (consumes `registry:*` attestations
  when `requireAttestation: true`)
- ADR-0030 — FP resolution + AV-vendor parallel (package-manager row
  of the product-family map)
- ADR-0031 — mcp-server as transport (composition rules)
- `docs/execution-plan.md` Gate G-C.2 / G-D — strategic context

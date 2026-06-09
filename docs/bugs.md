# Bug Log

> **Purpose:** Every load-bearing bug we hit, what caused it, how we
> fixed it, and what we now do to prevent the same mistake from
> reappearing. Written so that future-me (or any AI engineering
> partner) can grep this before re-deriving the same diagnosis.
>
> **Discipline:** When a bug bites us, it lands here BEFORE the fix
> commit merges. No bug gets fixed silently. Hallucinations and
> incorrect assumptions land here too — those are the most expensive
> bugs.

## How entries are structured

```
### N. Short title — date
**Phase:** when it bit us
**Symptom:** what we saw
**Root cause:** what was actually wrong
**Fix:** what we changed
**Prevention:** how we keep this from recurring (test, doc, lint, etc.)
**Lesson:** the one-liner future-me grep for
```

---

## Active log (most recent first)

### 27. Batch false positives on inter-session detector landings (T7 + T9) — 2026-06-04

**Phase:** 5.6 / 5.6.2 / 5.6.3 (T3 / T4 / T6 / T7 / T8 / T9 / T10 detectors landed across multiple PRs since Phase 5.6 opened).
**Symptom:** `phub audit . --check-lock` exits 1 with 19 of 23 artifacts flagged, 25 findings total. 18 CCI-009 `cc-attribution-required` hits across every primitive plus `CLAUDE.md`; 6 CCI-007 `vendor-typosquat` hits on `frontend-design-elite.md`. The `verify-before-load.test.ts` "returns safe against the project's own sealed CLAUDE.md" test fails because the flagged scanner findings flip `safe` to `false`.
**Root cause:** **Two independent causes that landed in the same window.**
  1. **Detector overbreadth at v0.1.** CCI-009's regex matches the literal `CC-BY-4.0` string anywhere in a file; CCI-007 matches the literal vendor names `Stripe / Vercel / Linear / Sigstore`. Both detectors fire on legitimate references — primitives declaring their OWN license, primitives referencing real vendors as design exemplars. Same structural class as docs/bugs.md #25 (v0.1 detectors prefer false positives to false negatives without markdown-AST awareness).
  2. **No mid-session FP triage.** PRs 5.6 / 5.6.2 / 5.6.3 each shipped a new detector that fired on already-merged primitives. No PR ran `phub audit --check-lock` against the project itself before merging the detector, so the FP backlog accumulated silently until a session ran a full audit.
**Fix:** **Path B triage applied per [ADR-0030](./decisions/0030-fp-resolution-and-av-vendor-parallel.md) § 1.** Three new ledger entries (FP-003 / FP-004 / FP-005) in [docs/false-positive-resolution.md § 6](./false-positive-resolution.md) + corresponding allow rules in `.primitivehub/policy.yaml`:
  - FP-003: `apps/web/content/primitives/**/*.md` × `CCI-009:cc-attribution-required` (primitive self-license declarations)
  - FP-004: `CLAUDE.md` × `CCI-009:cc-attribution-required` (meta-doc reference to corpus license)
  - FP-005: `apps/web/content/primitives/frontend-design-elite.md` × `CCI-007:vendor-typosquat` (real vendor names as design exemplars)
  Re-stamped `.primitivehub/phub.lock` to absorb the inter-session content changes (CBOM/Trust-Runtime PRs added new primitives + edited CLAUDE.md for ADR-0031 + ADR-0032 cross-refs). The failing `verify-before-load` test now passes — scanner findings clean under policy + lock state matches.
**Prevention:**
  - **Each detector PR MUST run `phub audit --check-lock` against the project itself before merge** — silent FP accumulation is the discipline gap this incident exposed. Wire into `.github/workflows/phub-ci.yml` as a step on every PR touching `apps/api/scanners/**` or `packages/phub/src/scanners/**`.
  - **Path-C tightening tracked for CCI-009 and CCI-007** — both detectors should distinguish "frontmatter / declaration / reference" from "body / impersonation / quotation" contexts. v0.2 markdown-AST awareness (per #25 prevention) is the shared substrate; see FP-003 / FP-004 / FP-005 in the methodology ledger for the specific shape each detector's Path-C work needs to take. When the v0.2 detectors ship, the corresponding allow entries are removed in the same lockstep PR.
  - **Detector-landing PR template** SHOULD include a "Project-level audit run" checklist item alongside the existing test/typecheck items.
**Lesson:** A growing detector roster + a growing primitive corpus + no inter-PR audit discipline = silent FP backlog. The FP methodology shipped under ADR-0030 *was* the right answer; what was missing is the per-PR enforcement that catches drift before it reaches a quarterly re-review. Detector authors carry FP responsibility, not just precision-against-fixture responsibility.

### 26. Pre-launch site went public via host-level nginx + Cloudflare A records — 2026-06-02

**Phase:** Pre-launch (Phase 5.5 / Gate G-C, ~16 weeks before target launch)
**Symptom:** `https://www.primitivehub.ai` and `https://primitivehub.ai` served the production Next.js build over public HTTPS with a valid Let's Encrypt cert. Cloudflare A records for `@` and `www` pointed to the Hetzner host IP `178.105.164.250`. Anyone with the URL could browse every page of the site. The `noindex` defenses still held (`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex`) so search engines stayed out, but the project's pre-launch secrecy invariant was already broken to anyone who knew the domain. Caught when the user did `curl https://www.primitivehub.ai` and saw a 200 from the production build.
**Root cause:** Three stacked violations of the "localhost-only" rule (CLAUDE.md hard rule #3 + the `feedback-localhost-only` memory), each operating on a different layer:
  1. **Host-level reverse proxy outside compose.** `/etc/nginx/sites-enabled/primitivehub` listened on `0.0.0.0:80` and `0.0.0.0:443` with a Let's Encrypt cert for `primitivehub.ai` / `www.primitivehub.ai`, proxying `/` to `127.0.0.1:3000`. The prior version of the localhost-only rule explicitly covered compose port specs and direct process binds, but not host-level reverse proxies that bind to a public interface and forward to a localhost upstream. The compose spec for `web` was correctly `127.0.0.1:3000:3000`, so the rule *appeared* to be honoured. The public exposure took a path the rule did not name.
  2. **Stale container port bindings.** `web` (created 2026-05-30) and `authentik-server` (created 2026-05-29) were started days before `compose.yaml` was fixed to use the `127.0.0.1:` host-IP prefix. `docker compose up -d` does not re-create a container when only its port spec changes — it diffs container config, and port specs aren't in that diff. The running containers retained `HostConfig.PortBindings.HostIp: ""` (== `0.0.0.0`), exposing `178.105.164.250:3000` and `178.105.164.250:9000` directly, *bypassing nginx entirely*. So even if nginx had been stopped, the IP would still have served the site.
  3. **Public DNS records pointing to the origin.** Cloudflare A records for `primitivehub.ai` and `www.primitivehub.ai` resolved to `178.105.164.250`. Cloudflare's orange-cloud proxy doesn't change this — it makes the *resolver* see Cloudflare, but the cert + origin still need to exist and the proxy chain still hits the host. Setting any A record pointing at the dev/staging host IS a public deploy under the pre-launch posture rule; the orange-cloud proxy is a CDN feature, not a posture.
**Fix (three-layer kill, executed 2026-06-02):**
  1. **Cloudflare:** A records for `primitivehub.ai` and `www.primitivehub.ai` deleted. Verified with `dig +short www.primitivehub.ai A` → empty.
  2. **Host nginx:** `sudo systemctl stop nginx && sudo systemctl disable nginx`. `/etc/nginx/sites-enabled/primitivehub` and the Let's Encrypt cert left on disk — re-launch stays reversible. Verified with `systemctl is-active nginx` → `inactive` and `ss -tlnp | grep -E ':80|:443'` → empty.
  3. **Compose containers:** `docker compose -f compose.yaml -f compose.prod.yaml up -d --force-recreate --no-deps web authentik-server` forces docker to re-read the port spec from `compose.yaml`. Verified with `docker ps --format '{{.Names}}\t{{.Ports}}'` → `127.0.0.1:3000` and `127.0.0.1:9000`. Dev workflow (VS Code Remote SSH to Hetzner with `-L` port-forward) unaffected — services still listen on `127.0.0.1` inside the host; SSH forwarding still hits them.
  4. **Firewall (belt-and-braces, pending operator):** `sudo ufw deny 80,443,3000,9000/tcp`. SSH on 22 stays allowed.
**Prevention:**
  - **`feedback-localhost-only` memory generalized** — the rule now explicitly covers (1) compose port specs, (2) direct process binds, (3) host-level reverse proxies, (4) public DNS records, (5) firewall, (6) stale container state. A pre-claim audit checklist with six concrete `curl`/`dig`/`docker`/`systemctl` invocations was added; "it's not public" means every line of that checklist returns the safe value.
  - **CI guard (✓ landed via [ADR-0031](./decisions/0031-pre-launch-posture-automation.md)):** `scripts/check-port-bindings.sh` greps `compose*.yaml` for any port spec without an IP prefix (using the "two-colon minimum" canonical test, awk-based for clarity); exits 1 on violation. Wired into [`/.github/workflows/pre-launch-posture.yml`](../.github/workflows/pre-launch-posture.yml) on every PR + push to main. The sibling `scripts/check-pre-launch-posture.sh` extends to all six layers and runs on the live host (default mode) or layer-1-only (`--ci` mode) — CI uses the latter; operators run the former pre-deploy and via nightly cron.
  - **Stale-container note added to apps README + CLAUDE.md build-hygiene section** — after editing a port spec in `compose*.yaml`, `docker compose up -d` is not enough; `--force-recreate --no-deps <service>` is required.
  - **Pre-flight rule for any host-level service:** before adding nginx/traefik/caddy/cloudflared/anything that binds the host network, write an ADR with the launch-posture analysis. Pre-launch, the answer is always "no public bind." This is a new instance of [[project-launch-posture]] discipline.
**Lesson:** "Localhost-only" is a property of the whole network path, not any single layer. A correctly configured compose port spec is necessary but not sufficient — host-level reverse proxies, DNS records, stale container state, and missing firewall rules can each independently defeat the invariant. Before launch, audit *every* layer that can answer "does my origin IP serve content to the public internet?": (1) compose, (2) direct process binds, (3) host services, (4) DNS, (5) firewall, (6) running-container state. If any one says yes, the site is public. Cloudflare orange-cloud is not a defense — it's a CDN. And `docker compose up -d` is not a port-spec migration tool — it's a config diff. Both are quiet failure modes that look like they're doing the right thing.

### 25. `phub scan` flags own CLAUDE.md with T5 false positive — 2026-05-31

**Phase:** 5.5 (PR 5.5.3 — `@primitivehub/phub` CLI v0.1)
**Symptom:** `phub scan /srv/primitivehub/app/CLAUDE.md` exits 1 with
two `t5.unsafe_shell_install` matches on lines 244 + 246. The matched
text is `npx skill` and `npx\n   install` — both inside the project's
own hard-rule prose explicitly *forbidding* npx skill installs as a
T5 attack vector. There is no actual `curl|bash` or executable install
instruction in the file.
**Root cause:** The v0.1 detector regex
`\bnpx\s+(?:-y\s+|--yes\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-][a-zA-Z0-9@/_.-]+`
matches any occurrence of "npx" followed by an identifier-shaped word,
anywhere in a markdown document. It has no awareness of negation
("**No** npx skill installs"), no awareness of fenced code blocks vs.
prose, and no awareness of when a document is *teaching about* an
attack vs. *instructing the agent to execute* it. This is the
documented v0.1 false-positive case — see
`apps/api/scanners/t5_unsafe_shell_install.py:37-47` docstring:
> "A primitive teaching about CI/CD or package management may
> legitimately show install commands as EXAMPLES. … Markdown-AST
> awareness in v0.2+ will distinguish code-fence quotes from
> top-level instructions. For now: false positives are preferable
> to false negatives."
**Fix:** **Working-as-intended in v0.1.** No fix lands in this PR.
The v0.1 product stance is "flag and bounce to manual review" rather
than risk a missed Shai-Hulud vector — the cost asymmetry of a
missed attack vs. a false positive is enormous (see same docstring).
**Prevention (v0.2 work, tracked):** Add markdown-AST aware scanning
to both the Python and TS detectors. Distinguish:
  - inline code spans (`` `npx foo` ``) — likely a quote, lower severity
  - fenced code blocks (```` ```npx foo``` ````) — likely an example, requires inspection
  - top-level instruction prose ("run `npx foo` to install") — original FAIL severity
  - negated prose ("never run `npx foo`") — INFO not FAIL
Implementation needs a real markdown parser (probably `remark`/`mdast`
on the TS side; `mistune` or `markdown-it-py` on the Python side) and
matching ASTs on both sides per ADR-0023 lockstep rule.
**Lesson:** Regex-on-raw-text detectors WILL fire on security-teaching
content. This is a feature in v0.1 (defense-in-depth via human review)
and a bug to fix in v0.2 (precision via AST). The detector docstring
called this out from day one — the system worked exactly as the
detector author predicted on a real document. Validates both:
  - The detector is sensitive enough to catch real attacks (good).
  - The AST work needs to be a v0.2 priority before any wide adoption
    push (the noise will be unacceptable for users without context).
The fact that the project's own documentation hits the false positive
on first run is the strongest possible argument for the v0.2 ramp.
**Operationally resolved (2026-06-01) via ledger entry FP-001 in
[`docs/false-positive-resolution.md`](./false-positive-resolution.md):
the project ships its own `.primitivehub/policy.yaml` with a narrow
`detail_tags: [npx-arbitrary-install]` allow on `CLAUDE.md` so
`phub audit .` runs clean against the repo. The v0.2 markdown-AST work
is still the right long-term fix and will retire the allow.**

### 24. Local Authentik not on sigstage Fulcio allowlist — 2026-05-30

**Phase:** 4 (Sigstore keyless signing, PR #3)
**Symptom:** SigstageBackend.sign() called with a local Authentik OIDC
token returns 400 from sigstage Fulcio with "unsupported issuer". The
identical code path works against public Sigstore when the token is
from an allowlisted issuer (Google, GitHub Actions, AWS, etc.).
**Root cause:** Sigstore Fulcio (both production and staging) maintains
an allowlist of acceptable OIDC issuers. Our local Authentik at
`http://authentik-server:9000/application/o/primitivehub/` is not
allowlisted, and Fulcio requires HTTPS-public issuers anyway.
sigstage's allowlist (https://github.com/sigstore/fulcio/blob/main/
config/identity/staging/config.yaml) is broader than production's but
still finite.
**Fix:** **Pending.** Three options, deferred to Phase 4 follow-up:
  1. Submit our public-facing Authentik (post-launch HTTPS) to
     sigstage's allowlist via PR.
  2. For dev/CI signing tests, use a GitHub Actions ambient OIDC
     token (sigstage allowlists `https://token.actions.githubusercontent.com`).
  3. Phase 7 self-hosted Sigstore controls its own allowlist;
     enterprise customers won't hit this.
For Phase 4 PR #3 today: the integration test (`tests/test_signing_
integration.py`) is `pytest.mark.integration` and skipped by default.
Operators run it manually with a `SIGSTAGE_OIDC_TOKEN` from an
allowlisted issuer.
**Prevention:** ADR-0011 documents the constraint; Phase 4 PR #3's
integration test refuses to run without SIGSTAGE_OIDC_TOKEN; apps/api/
README.md explains how to obtain one.
**Lesson:** OIDC-based services with finite issuer allowlists need to
be checked against your IdP's issuer string BEFORE designing the
auth flow. "We use OIDC" isn't enough — Fulcio cares about WHICH
issuer.

### 23. Docker anonymous volumes don't auto-refresh when image content changes — 2026-05-30

**Phase:** 4 (Procrastinate worker, PR #1)
**Symptom:** Adding a new service that reuses the same image (api-worker
reusing primitivehub-api:dev) failed with `ModuleNotFoundError: No
module named 'corsheaders'` at startup, even though the api container
imports it fine.
**Root cause:** Compose mounts `- /opt/venv` as an anonymous volume.
On first `docker compose up`, Docker creates the anonymous volume and
populates it from the image. On subsequent `--force-recreate`, the
anonymous volume is RETAINED — only the container is replaced. If the
image's `/opt/venv` content changed (deps added since the volume was
first populated), the running container sees the stale volume content,
not the new image content. The api container's anon volume was created
months ago with corsheaders inside; api-worker created a fresh anon
volume, but from the same stale image-layer offset, missing corsheaders.
Worse, `docker compose build` succeeded — the issue only shows at run.
**Fix:** Use `--renew-anon-volumes` flag on `docker compose up`. The
worker came up green immediately after.
**Prevention:** Code comment in `compose.override.yaml` next to every
anonymous-volume mount explaining the renew flag. New entry in
`docker-compose-discipline` primitive § "When to use `--renew-anon-
volumes`".
**Lesson:** Anonymous volumes survive `--force-recreate`. To pick up
new image content in a volume-mounted path, use `--renew-anon-volumes`.

### 22. Pre-existing model/index naming drift (accounts + orgs) — 2026-05-30

**Phase:** 4 (discovered during PR #1 — Procrastinate worker)
**Symptom:** `python manage.py migrate` reports "Your models in app(s):
'accounts', 'orgs' have changes that are not yet reflected in a
migration". Specifically: User manager rename, and 4 index renames
across User + OrganizationMember.
**Root cause:** Index `name=` was not explicitly set in early
migrations, so Django auto-generated names. Subsequent Django version
updates produced different auto-name hashes, so `makemigrations` thinks
the indexes need to be renamed (no real schema change).
**Fix:** **Pending** — will land in its own micro-PR (`fix/api-migration-
drift-accounts-orgs`) that pins explicit index `name=` values via a
no-op migration. Holding the fix out of the Procrastinate PR keeps PR
scope clean per `docs/principles.md` § "One logical change per PR".
**Prevention:** Lint rule + ADR (deferred): "every Index/Constraint
declaration must specify an explicit `name=`". Tracking issue in
roadmap.
**Lesson:** Auto-generated index names are a deferred bill — they break
silently across Django version bumps. Always name your indexes.

### 1. OIDC same-issuer breaks compose-dev networking — 2026-05-30

**Phase:** 3.5 (OIDC login, Step 7)
**Symptom:** Either browser hangs on `/authorize` redirect (can't resolve
`authentik-server`) OR server-side `/token` POST fails with "connection
refused" (web container's `localhost:9000` is the container itself, not
Authentik).
**Root cause:** Single `OIDC_ISSUER_URL` can't serve both browser-facing
(`/authorize`) and container-internal (`/token`) endpoints in a Docker
Compose setup with port mappings. The browser sees the host's port
mapping; the container sees compose service names.
**Fix:** Split into two env vars — `OIDC_ISSUER_URL` (server-facing,
docker hostname) for `/token` + `OIDC_BROWSER_ISSUER_URL` (browser-
facing, host port mapping) for `/authorize` and `/end-session`. Default
the browser var to the server var so production (single hostname) doesn't
need both.
**Prevention:** README "Why the two-issuer model" section in
`apps/web/README.md`. Code comment in `apps/web/lib/auth/oidc-config.ts`
explains the failure modes if anyone merges them back.
**Lesson:** Compose port-mapped services need separate hostnames for
browser-facing vs container-facing in any URL the client follows.

### 2. Authentik auto-kebab-cases application slugs — 2026-05-30

**Phase:** 3.5 (OIDC provisioning)
**Symptom:** `/authorize` returns "Not Found" even with correct client_id.
**Root cause:** Authentik's "Create Application" form auto-fills the
Slug field from the display name. `PrimitiveHub` becomes
`primitive-hub`. The provisioning step assumed `primitivehub` (no
dash); the URL pointed at a slug Authentik didn't have.
**Fix:** Override the slug at create time, or align the env URLs to
match the actual slug.
**Prevention:** README step 3 calls this out explicitly: "Authentik
auto-kebab-cases the display name. Don't trust the auto-fill; verify
the slug field after typing the name."
**Lesson:** When a form auto-derives a value from another field,
re-read the auto-derived value before saving.

### 3. `docker compose restart` doesn't re-read env_file — 2026-05-30

**Phase:** 3.5 (OIDC env injection)
**Symptom:** Updated `apps/web/.env` with new OIDC_CLIENT_ID; restarted
web container; container env still showed old value.
**Root cause:** `docker compose restart` reuses the existing container's
process environment. Env_file is read once at container create, not at
restart.
**Fix:** `docker compose up -d --no-deps --force-recreate web` is the
reliable path.
**Prevention:** README step 5 explicitly notes the restart-vs-recreate
distinction with the working command.
**Lesson:** Container env_file changes require `--force-recreate`. Plain
`restart` won't do it.

### 4. Authentik reputation policy silently locks out admin — 2026-05-29

**Phase:** 3.5 (first Authentik bootstrap)
**Symptom:** akadmin password is correct (verified at the User model
level with `check_password()` returning True), but UI reports "Invalid
password".
**Root cause:** Authentik's default authentication flow includes a
reputation policy. After ~3 failed login attempts from the same IP, the
flow rejects subsequent attempts even with correct credentials, with
the same "Invalid password" error message (no distinction).
**Fix:** `Reputation.objects.all().delete()` in `ak shell`.
**Prevention:** README troubleshooting section documents the
`Reputation.objects.all().delete()` command + the password-reset shell
snippet. Both go together — clear reputation AND reset password.
**Lesson:** Auth failures with correct creds → check for IP/identity
reputation policies before re-checking the password.

### 5. AUTHENTIK_BOOTSTRAP_PASSWORD doesn't apply post-init — 2026-05-29

**Phase:** 3.5 (first Authentik boot)
**Symptom:** `AUTHENTIK_BOOTSTRAP_PASSWORD` set in compose env, but akadmin
rejects that password.
**Root cause:** Authentik's bootstrap env vars only apply on FIRST
init of the cluster. If Authentik's DB was created by the postgres
init script (via `POSTGRES_MULTIPLE_DATABASES=authentik`) BEFORE the
authentik-server container was first started with `AUTHENTIK_BOOTSTRAP_*`
set, the user gets created with Authentik's defaults, not our env.
**Fix:** Reset via `ak shell` — `User.objects.get(username='akadmin').
set_password('<new>'); save()`.
**Prevention:** README documents the reset command. CLAUDE.md notes
that Authentik's bootstrap is first-init-only.
**Lesson:** Bootstrap env vars in IdPs typically apply once. After
that, the IdP's own data is canonical and env vars are decorative.

### 6. Memory exhaustion masquerades as application bugs — 2026-05-29

**Phase:** 3.5 (Authentik admin UI slowness)
**Symptom:** Authentik admin shows endless spinner; navigating between
tabs hangs. Looks like an Authentik bug or a Next.js bug.
**Root cause:** Host had 3.7 GB RAM, 161 MB free, NO SWAP. The full
stack (web dev + api + postgres + valkey + authentik server + authentik
worker) needs ≥2.5 GB resident, peaks higher. Memory pressure caused
Authentik request stalls.
**Fix:** Upgrade host to 8 GB. Stop web while doing auth/admin work
(frees ~1 GB). Add 4 GB swap as cushion.
**Prevention:** CLAUDE.md "Dev host minimum" section makes the
8-GB-plus-swap requirement load-bearing. First triage in any
slowness report: `free -h`.
**Lesson:** When the application looks slow but logs are clean and
CPU is low, check memory before re-deriving the bug. Half of "slow
application" reports on undersized hosts are memory pressure.

### 7. VS Code port forwarding chokes on chatty APIs — 2026-05-30

**Phase:** 3.5 (Authentik admin UI access)
**Symptom:** Authentik admin in browser is very slow, even after host
upgrade. Server-side timings are <100ms per call.
**Root cause:** VS Code's port-forward HTTP proxy serializes concurrent
requests. Authentik admin fires ~20 concurrent API calls per page
navigation; queueing makes each tap feel like molasses.
**Fix:** Use SSH local-port-forward from a local terminal: `ssh -L
9000:localhost:9000 -L 3000:localhost:3000 -N <server>`.
**Prevention:** README troubleshooting section + suggestion to use SSH
forwarding for any chatty admin UI.
**Lesson:** VS Code port-forward is fine for hello-world; chatty UIs
need direct SSH forwarding. Diagnose by curl-ing from the server
itself first to rule out server-side issues.

### 8. Postgres app role was superuser → RLS silently bypassed — 2026-05-29

**Phase:** 3.5 (Postgres tests + RLS activation, Step 5)
**Symptom:** RLS migrations applied. FORCE ROW LEVEL SECURITY set on
every tenant table. Application-level scoping worked. But raw SQL
queries (bypassing the application filter) still returned cross-tenant
rows.
**Root cause:** The api container connected as the `primitivehub`
Postgres role, which was the bootstrap superuser (Postgres docker-entry
default for POSTGRES_USER). **Superusers unconditionally bypass RLS,
regardless of FORCE.** So RLS was effectively a no-op in dev and would
have been in prod.
**Fix:** Create `primitivehub_app` role with `NOSUPERUSER NOBYPASSRLS
LOGIN CREATEDB`. App + tests connect as this role. Migrations also run
as this role (so they own the tables, and FORCE applies to the owner
too).
**Prevention:** `infra/postgres/init-multi-db.sh` creates the non-
superuser role on first cluster init. `tests/test_rls_actually_isolates.py`
proves at the DB layer that RLS denies cross-tenant access — a regression
to superuser would fail the test.
**Lesson:** RLS only enforces against non-superuser non-BYPASSRLS roles.
Default Docker Postgres POSTGRES_USER is a superuser. Always create a
separate app role explicitly.

### 9. sqlite tests skip RLS migrations → defense-in-depth unverified — 2026-05-29

**Phase:** 3.5 (test posture)
**Symptom:** All 46 tests pass on sqlite. RLS migrations have an
`if vendor != "postgresql": return` early return. Tests verify
application-level scoping but never exercise RLS.
**Root cause:** Bootstrap settings_test.py used sqlite for speed. RLS
migrations gracefully skip non-Postgres backends. Net effect: the
defense-in-depth layer the spec promises was unverified, and there
was no test that would fail if RLS regressed.
**Fix:** Switch settings_test.py to Postgres (dedicated `primitivehub_test`
DB on the same compose service). Add `test_rls_actually_isolates.py`
that bypasses the ORM and exercises the policy directly. Forbid sqlite
in tests via CLAUDE.md.
**Prevention:** `pytest --reuse-db` against the test DB on every run.
The RLS-integration test fails loudly if the policy regresses.
**Lesson:** When tests skip a security control "for speed", the
security control isn't tested. Use the production stack in tests, or
explicitly own the gap.

### 10. Ninja default renderer ignores Pydantic serialize_by_alias — 2026-05-29

**Phase:** 3 (orgs + registry endpoints, Step 2)
**Symptom:** Frontend expects camelCase JSON (`organizationSlug`,
`createdAt`); API returns snake_case (`organization_slug`, `created_at`)
despite `serialize_by_alias=True` in the Pydantic Schema config.
**Root cause:** Ninja's default JSON renderer calls `model_dump()`
without `by_alias=True`. The Pydantic config flag is honored by
`model_dump()` (which our manual test showed) but Ninja's render path
takes a different code path.
**Fix:** `Router(by_alias=True)` on every router. Additionally override
`model_dump()` on the `CamelSchema` base to force `by_alias=True` by
default, AND ship a `CamelJSONRenderer` for any code path that bypasses
the router-level flag.
**Prevention:** Parity test (`tests/test_parity.py`) verifies every
web literal maps to a backend enum. Camel-case wire format is checked
in every endpoint test via assertion on the dict key.
**Lesson:** `Pydantic.model_config.serialize_by_alias=True` is honored
by `model_dump()` but NOT by framework integrations that call their
own serialization path. Configure the framework AND the Pydantic
model.

### 11. Ninja + Pydantic 2.13: UploadedFile forward-ref breaks under `from __future__ import annotations` — 2026-05-29

**Phase:** 3 (content-addressed storage upload endpoint, Step 3)
**Symptom:** `pydantic.errors.PydanticUserError: FileParams is not
fully defined; you should define UploadedFile, then call
FileParams.model_rebuild()`. Endpoint returns 500 on every request.
**Root cause:** With `from __future__ import annotations`, the
`content: UploadedFile = File(...)` parameter annotation is a string
at runtime. Pydantic builds a per-endpoint `FileParams` model that
references `UploadedFile` by string, then can't resolve it from inside
Ninja's module.
**Fix:** Bypass Ninja's typed File/Form params for the upload endpoint;
read multipart directly via `request.POST` / `request.FILES`.
**Prevention:** Code comment in `apps/api/registry/api.py` explains
why we don't use the typed Ninja decorators on this endpoint. Watch
for Ninja's fix upstream.
**Lesson:** Pydantic forward-ref resolution + framework-introspected
type annotations + `from __future__ import annotations` can collide.
When you see a forward-ref error in a third-party framework's
parameter parsing, try the raw-request path first.

### 12. Compose `environment:` empty defaults override env_file — 2026-05-29

**Phase:** 3 (env-file wiring for R2)
**Symptom:** `apps/api/.env` had the R2 credentials. `env_file:` on
the api service pointed at it. `docker compose exec api env | grep S3_`
showed empty strings, not the .env values.
**Root cause:** `compose.yaml` had `S3_ENDPOINT_URL: ${S3_ENDPOINT_URL:-}`
in the `environment:` block. Empty string from the `${VAR:-}` default
*wins* over env_file due to compose precedence rules.
**Fix:** Remove the S3_* defaults from `compose.yaml`'s `environment:`
block. Let env_file populate them in dev; production sets them via
its own secrets path.
**Prevention:** Compose comment block explaining the precedence
rule and warning not to add empty `${VAR:-}` defaults for secrets.
**Lesson:** Compose's `environment:` always beats `env_file:`. An
empty-string default in `environment:` silently disables env_file.

### 13. Phase 3 bootstrap: `apps.X` imports without `apps/` package — 2026-05-29

**Phase:** 3 (initial verification of Step 2 commits)
**Symptom:** `manage.py check` and pytest both fail with
`ModuleNotFoundError: No module named 'apps'`. Smoke tests masked the
bug because they never touched the models.
**Root cause:** Phase 3 bootstrap wrote `INSTALLED_APPS = ["apps.accounts",
"apps.orgs", ...]` and `from apps.X import` in every model file. But
the container WORKDIR is `/app` and the apps live at `/app/accounts/`,
not `/app/apps/accounts/`. No `apps/__init__.py` exists.
**Fix:** Rename `INSTALLED_APPS` to bare names + rewrite every `from
apps.X import` to `from X import`. AppConfig.name updated to match.
**Prevention:** Step 2's commit message explicitly documents the
rename. The verification pipeline (ruff/mypy/Django check/pytest)
catches it.
**Lesson:** Smoke tests that don't load models can't catch import-path
bugs. `manage.py check` is a more thorough first-line check than a
test that only hits one endpoint.

### 14. Pytest-django dropped+recreated test DB, losing role grants — 2026-05-29

**Phase:** 3.5 (Postgres tests + RLS)
**Symptom:** Test runs initially green, then break on subsequent runs
with "permission denied on table" errors against `test_bypass_rls`
role.
**Root cause:** pytest-django default behavior is `--create-db`: drops
and recreates the test database between sessions. Role grants applied
to the test DB are not in any migration — they were applied manually
to the existing DB, so they disappeared with the recreate.
**Fix:** `--reuse-db` in pyproject's pytest addopts. The test DB
persists; grants survive.
**Prevention:** CLAUDE.md backend hygiene section documents the
`--reuse-db` requirement.
**Lesson:** Any test-DB-level state (roles, grants, extensions) that
isn't in a migration vanishes when pytest-django recreates the DB.
Either put it in a migration, or use `--reuse-db`.

### 15. SET LOCAL row_security=off doesn't bypass — it errors instead — 2026-05-29

**Phase:** 3.5 (RLS test fixture setup)
**Symptom:** Test fixture tried `SET LOCAL row_security = off` to insert
cross-tenant data; INSERT failed with "query would be affected by
row-level security policy".
**Root cause:** Postgres `row_security = off` is the FAIL-LOUD mode, not
the bypass mode. When `off`, any query that would have been filtered
by a policy errors instead of silently filtering. The intent of the
setting is safety (you can verify NO policy is applying), not bypass.
**Fix:** Use `SET ROLE test_bypass_rls` to switch to a BYPASSRLS role
for fixture setup. The test body then `RESET ROLE` to drop back to the
real app role for the actual assertion.
**Prevention:** Comment in `tests/conftest.py` explains why we use the
ROLE-switching pattern and not row_security.
**Lesson:** `row_security` flag is not what you think it is. Read the
Postgres docs carefully before assuming a setting means "bypass".

### 16. ATOMIC_REQUESTS + test-fixture SET ROLE collision — 2026-05-29

**Phase:** 3.5 (RLS test middleware + tests)
**Symptom:** Existing tests passing under Postgres without the tenant
middleware; once ATOMIC_REQUESTS=True was added (for SET LOCAL to
work in the middleware), existing tests started failing with "permission
denied" on accounts_user.
**Root cause:** `ATOMIC_REQUESTS=True` wraps each request in
`transaction.atomic()`. The pytest fixture's `SET ROLE test_bypass_rls`
was set in the OUTER test transaction. The nested per-request
transaction inherits the role at start, but the role is reset when
the inner transaction commits, breaking subsequent statements.
**Fix:** `ATOMIC_REQUESTS=False` in settings_test (production keeps
True). The tenant middleware opens its own `transaction.atomic()` so
SET LOCAL still works in prod; tests don't need it because the role
is set once at fixture time.
**Prevention:** Comment in settings_test.py explains the split.
**Lesson:** Transaction nesting + session-level role changes interact
badly. Either fully embrace transactions (ATOMIC_REQUESTS + per-test
transaction) OR fully avoid them (no ATOMIC_REQUESTS + middleware
opens its own). Mixing causes silent role drift.

### 17. Initial Edit to wrong directory: orgs/api.py landed outside apps/api — 2026-05-29

**Phase:** 3 (Step 2, first attempt at writing endpoints)
**Symptom:** Files written successfully to `apps/orgs/schemas.py` and
`apps/registry/api.py` (instead of `apps/api/orgs/...` and
`apps/api/registry/...`). Syntax check passed; Django import broke.
**Root cause:** My own path mistake. The full path `/srv/primitivehub/app/
apps/orgs/schemas.py` doesn't include the `api/` segment that the
Django project lives under. The structure is `apps/api/<django-app>/`,
not `apps/<django-app>/`.
**Fix:** `mv` the misplaced files to the correct location; `rmdir` the
empty wrong dirs.
**Prevention:** Documented in the post-bootstrap commit message.
First action on any new branch: `pwd` + `ls apps/api/` to ground myself
in the actual layout before writing.
**Lesson:** When writing new files, double-check the absolute path
against the existing project structure. Single misplaced segment can
cause silent breakage.

### 18. Wrong Authentik Client ID pasted into env (regenerated after copy) — 2026-05-30

**Phase:** 3.5 (OIDC end-to-end)
**Symptom:** Even after fixing the slug, /authorize still returned
errors. The Client ID in `.env` (`qrVOX2dU...`) didn't match
Authentik's actual Provider record (`37nIuxfj...`).
**Root cause:** Authentik regenerated the client_id sometime between
the initial copy and the paste — possibly when the user re-saved the
Provider, possibly because the value pasted was from a different
copy buffer. The user pasted an outdated value in good faith.
**Fix:** Pull the actual current values from Authentik via `ak shell`:
`OAuth2Provider.objects.get(name='...').client_id` /
`.client_secret`. Update .env. Force-recreate web.
**Prevention:** README troubleshooting section documents the `ak shell`
snippet for retrieving the current credentials. Anytime client_id
"doesn't work", check it against Authentik's DB first.
**Lesson:** Don't trust manually-copied secrets. Always verify against
the source of truth before chasing other bugs.

### 19. SSH default username assumed local Windows username — 2026-05-30

**Phase:** 3.5 (setting up SSH port-forward for Authentik admin)
**Symptom:** `ssh -L 9000:localhost:9000 178.105.164.250` failed with
"Permission denied (publickey)" even though Remote-SSH was working.
**Root cause:** SSH client defaulted username to the local Windows
username (`notth`) when no `User` directive in `~/.ssh/config` and no
`user@` in the command. Server user is `primitive`.
**Fix:** `primitive@host` in the command, or `User primitive` in the
config block.
**Prevention:** apps/web/README.md troubleshooting note includes the
`primitive@host` form.
**Lesson:** SSH config without an explicit `User` directive falls back
to the local username, which is rarely what you want for a server with
a different user.

### 20. Authentik startup port forwarded but service never started — 2026-05-30

**Phase:** 3.5 (first attempt to reach Authentik admin)
**Symptom:** User forwarded port 9000 in VS Code, browser showed
nothing. Diagnosis chain assumed VS Code forward was broken.
**Root cause:** The `authentik-server` and `authentik-worker` services
were defined in `compose.yaml` but were never started — only api,
postgres, valkey, and web were running. There was nothing to forward
to.
**Fix:** `docker compose up -d authentik-server authentik-worker`.
First-boot took ~30s.
**Prevention:** Before diagnosing connectivity issues, always
`docker compose ps` to confirm the service is actually running.
**Lesson:** "Port not responding" can mean (a) network path broken,
(b) service crashed, or (c) service never started. Check (c) first —
it's the cheapest test.

### 21. `_set_bypass_rls_role` autouse autouse typo — 2026-05-29

**Phase:** 3.5 (conftest.py)
**Symptom:** None — caught by self-review, not a runtime issue.
**Root cause:** Hallucinated word doubling in fixture docstring
("autouse autouse session+function fixture"). I generated text twice.
**Fix:** Reviewed by reading my own output, edited the docstring.
**Prevention:** Always re-read written documentation, especially
adjacent-word repetitions which LLMs are prone to.
**Lesson:** I make this specific class of typo. Re-read for
"X X" patterns in my own writing before committing.

### 22. CamelCase response field name change broke test (`dev_bypass` → `devBypass`) — 2026-05-30

**Phase:** 3.5 (OIDC /whoami enrichment, Step 7)
**Symptom:** `test_whoami_with_dev_bypass` failed with `KeyError:
'dev_bypass'` after enriching /whoami to use camelCase.
**Root cause:** Renamed the wire field to match frontend convention but
forgot to update the existing smoke test that asserted on the old
name.
**Fix:** Updated test to `data["devBypass"]`. Added assertion on the
new `user` payload.
**Prevention:** When renaming a response field, grep tests for the old
name. The parity test (`test_parity.py`) doesn't cover field-name
changes — only enum value changes. Add a "wire field names" parity
test if this recurs.
**Lesson:** Renaming a public API field requires sweeping all tests
that consume it. Grep before pushing.

---

### 23. `/check` ran its whole scan inside a single-threaded web request — launch-day DoS waiting to happen — 2026-06-09

**Phase:** 5 (public `/check` surface, ADR-0034)
**Symptom:** Not a runtime crash yet — found by audit before launch. The
public `/check` endpoint did outbound tarball fetch (GitHub: `main` then
`master`, 30 s each) + decompress + untar + run the Top 10 over up to
20,000 files **synchronously inside the HTTP request**, served by a
single uvicorn process with no `--workers`.
**Root cause:** Under Django ASGI, sync views run in
`sync_to_async(thread_sensitive=True)` — one shared executor thread. So
`/check` serialized: a single slow scan blocked **every** request in the
process, including `GET /healthz`. The container healthcheck (10 s
interval, 5 s timeout) would then fail mid-scan and flap the whole API
down — not just `/check`. The per-IP rate limit bounds requests per
client but puts **no ceiling on global concurrency or total work**, so
launch traffic (or one IP firing 30 GitHub scans) saturates the thread.
**Fix:** Moved the scan off the request path onto the Procrastinate
`checks` queue with bounded `--concurrency` (ADR-0044). `POST /check`
enqueues → `202 + requestId`; `GET /check/{id}` polls. Web tier and
`/healthz` stay responsive under any scan load; worker concurrency is
the load ceiling. Input is handed off via Valkey (scrubbed post-scan),
never via Postgres job args (preserves ADR-0034 § 5).
**Prevention:** No blocking outbound I/O or unbounded CPU work inside a
web request on a single-process ASGI server — push it to the worker and
poll. New public surfaces declare where their heavy work runs in the
design note. Follow-ups still open: result caching, `mem_limit` on
`api`/`api-worker`, Valkey `maxmemory`, the `url`-mode DNS-rebinding
TOCTOU, and the verdict-engine band calibration (prompt injection →
`clean`).
**Lesson:** "Rate-limited per IP" is not "load-bounded." A per-client
limit says nothing about total concurrent server work; bound the
expensive thing globally (queue + concurrency cap), and never let a
public endpoint's slow path share a thread with the health check.

---

## Hallucination log (mistakes I made in design, not runtime)

These are different from bugs — they're places where I (the AI
engineering partner) made an incorrect assumption that surfaced as a
mistake in design or code before runtime caught it. Worth tracking so
I don't repeat them.

### H1. Assumed Authentik bootstrap env vars apply post-init

Hallucinated that AUTHENTIK_BOOTSTRAP_PASSWORD would set the password
on every container start. It applies only on first-init. Recovery
required `ak shell` reset. (See Bug #5.)

### H2. Assumed `docker compose restart` re-reads env_file

Most container guides phrase "restart picks up env changes" — true for
host-level env vars, NOT for env_file injections. (See Bug #3.)

### H3. Assumed Pydantic `serialize_by_alias` was honored by Ninja

Read the Pydantic v2 changelog, assumed framework integrations
respect it. They don't, by default. Required per-router config. (See
Bug #10.)

### H4. Assumed Postgres `row_security = off` was a bypass flag

It's a fail-loud flag. (See Bug #15.)

### H5. Celebrated "sqlite-test compatibility" as a feature

It was actually a Phase 3 bootstrap defect. The user caught this. (See
Bug #9.)

### H6. Forgot that Postgres POSTGRES_USER is a superuser by default

The Docker Postgres entrypoint creates POSTGRES_USER as a SUPERUSER.
RLS doesn't apply. Required creating a separate app role. (See Bug #8.)

### H7. Wrote `_set_bypass_rls_role autouse autouse` in a docstring

Word-doubling typo. Caught on re-read. (See Bug #21.)

### H8. Assumed VS Code port forward would be fast for Authentik admin

VS Code's HTTP proxy doesn't multiplex concurrent requests well. Looks
fine for hello-world; broken for chatty UIs. (See Bug #7.)

---

## How to add an entry

1. Find the failure. Run the verification step(s) you know should
   catch it.
2. Diagnose to root cause. NOT the first thing that "looks suspicious"
   — the actual mechanism. If you don't know, say "unknown, hypothesis:
   ...".
3. Write the fix. Then add the bug entry BEFORE committing the fix.
4. Add prevention. The fix isn't done until the same class of mistake
   won't recur. Test, doc, lint, comment — name what makes it sticky.
5. Add the lesson. One greppable line. Future-me searching this file
   for a similar symptom should find the right entry.

A bug merging without an entry here is technical debt; a fix merging
that doesn't prevent recurrence is wasted work.

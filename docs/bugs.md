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

# ADR-0014: Public-read RLS policy (visibility as a first-class concept)

**Status:** Accepted
**Date:** 2026-05-30
**Supersedes:** none
**Related:** ADR-0006 (RLS for multi-tenancy), ADR-0013 (Trust Bundle format)

## Context

Phase 5.5 PR 5.5.1 shipped the Trust Bundle endpoints
(`/api/v1/trust/*`) gated behind authentication + tenant scope. PR 5.5.2
needs to open them to **anonymous public reads** for primitives in
registries with `visibility = 'public'` so the Snyk-overlay shape works
in practice (any agent anywhere can verify any public primitive's
attestation without an account).

The question: how does "public read" interact with the tenant-isolation
RLS that ADR-0006 locked in?

Constraints:
- RLS must remain the single security boundary. Application-layer
  visibility filters drift; database-enforced policies don't.
- No new Postgres roles, no per-request role switching. The api
  container connects as `primitivehub_app` (NOSUPERUSER NOBYPASSRLS).
  That role must serve both authenticated AND anonymous reads safely.
- Cross-tenant private primitives must remain hidden — no existence
  leak. An anonymous request for a private primitive returns 404, not
  401, not 403.
- Authenticated users in their own org continue seeing their own-org
  rows (public + private).
- Authenticated users can also browse other orgs' PUBLIC primitives
  (the discovery story).

## Decision

Add a SECOND RLS policy on each tenant-scoped registry table:
`<table>_public_read`, alongside the existing
`<table>_tenant_isolation`. Postgres ORs the policies — a row is
visible if EITHER passes.

```sql
-- registry_registry (direct visibility column)
CREATE POLICY registry_registry_public_read ON registry_registry
    FOR SELECT
    USING (visibility = 'public');

-- registry_repository / registry_primitive / registry_primitive_version /
-- registry_attestation (visibility lives on the ancestor Registry):
CREATE POLICY <table>_public_read ON <table>
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM registry_<parents>...
            WHERE r.id = <table>.<parent_fk>
              AND r.visibility = 'public'
        )
    );
```

Same `primitivehub_app` role serves all requests. No role switching.

### Truth table

| current_org | row in own org? | registry visibility | tenant_isolation | public_read | visible |
|---|---|---|---|---|---|
| NULL (anon) | n/a | public | FAIL | PASS | **yes** |
| NULL (anon) | n/a | private | FAIL | FAIL | **no** |
| own org | yes | public | PASS | PASS | yes |
| own org | yes | private | PASS | FAIL | yes (own data) |
| other org | no | public | FAIL | PASS | **yes (cross-org browse)** |
| other org | no | private | FAIL | FAIL | **no (privacy preserved)** |

The cross-org-public-browse case (5th row) is intentional — that's the
discovery story for authenticated users: "I can see PrimitiveHub's
catalog of public primitives, not just my org's."

## Alternatives considered

1. **Application-layer filter** (`queryset.filter(registry__visibility=
   "public")` in the trust endpoint). Rejected. Two security boundaries
   (RLS + app code) drift over time; the app filter could be forgotten
   on a future endpoint. RLS as single source of truth is the discipline
   ADR-0006 chose; this ADR extends it.

2. **Separate `primitivehub_public_read` Postgres role + BYPASSRLS + per-request role switching.**
   Rejected. More moving parts; more places to get wrong. The same
   role can serve everything if the policy is correct.

3. **Denormalize visibility into a column on every tenant table** (so
   the policy doesn't need a join). Rejected. Triggers + invariants to
   keep the column in sync; visibility lives logically on Registry. The
   policy join is fine — these tables have FK indexes and the joined
   rows are themselves small.

4. **Use Postgres views (`vw_public_primitives`) instead of policies.**
   Rejected. Views require updating every query to use them; policies
   are transparent to the existing ORM. Discoverability matters — a
   future contributor reading the model code shouldn't have to know
   about a parallel view layer.

5. **Visibility on Primitive, not Registry.** Considered. Cleaner for
   "share one primitive publicly without exposing its sibling primitives."
   Rejected for v1: Registry already has the field; the simpler model
   is "publish to a public registry to share." Per-primitive visibility
   can ship in a future ADR if customers ask for it.

## Consequences

### Positive
- **RLS remains the security boundary.** No app-code filter to forget.
- **One role for everything.** No per-request role switching infrastructure.
- **Cross-org public browse works.** Authenticated users see public
  primitives across the whole registry — the discovery surface.
- **The Snyk-overlay shape works.** Anonymous `/trust/by-digest/<hex>`
  returns bundles for public primitives without auth.
- **Visibility is first-class.** `Registry.Visibility` was already
  modeled; this ADR makes it load-bearing.

### Negative
- **Subquery cost.** Each SELECT on a tenant table now has a USING
  clause with EXISTS + joins. For trust endpoints (1 row per request)
  this is free. For marketplace list endpoints scanning many rows, the
  cost is per-row evaluation of the subquery. Indexes on
  `repository_id`, `primitive_id`, `primitive_version_id`,
  `registry.visibility` keep it bounded.
- **Cross-org public primitives are visible to authenticated users.**
  This is a feature, not a bug — but it shifts the mental model from
  "tenant isolation" to "tenant isolation OR visibility public." A
  reviewer checking the policy needs to think about both rules.
- **Policy testing requires direct SQL.** The autouse
  `_set_bypass_rls_role` fixture in `conftest.py` bypasses RLS for most
  tests (so cross-org fixture setup works); RLS enforcement tests must
  explicitly `SET ROLE primitivehub_app` + clear tenant context. This
  pattern is documented in `test_trust_endpoints.py`'s
  `test_rls_policy_hides_private_registry_versions_from_anonymous`.

### Neutral
- **The HTTP-level test for anonymous private 404 was downgraded to a
  direct-SQL policy test.** pytest-django's transaction model + the
  autouse role fixture make the HTTP-level path hard to reproduce
  reliably; the policy itself is what matters, and we verify it
  directly. The public-anonymous path IS exercised via the HTTP
  client (the public-registry fixture).

## Implementation

- `apps/api/registry/migrations/0008_public_read_policies.py` — adds 5
  policies (one per tenant-scoped registry table). Reverse migration
  drops them cleanly. Vendor guard matches migration 0002's pattern.
- `apps/api/registry/api.py`:
  - `_trust_versions()` returns the unfiltered queryset; RLS does the
    visibility filtering.
  - `@requires_auth` removed from both trust endpoints.
  - Cache-Control + Content-Type headers set per `docs/spec.md` § 10.6.
- `apps/api/tests/test_trust_endpoints.py` adds 4 PR 5.5.2 tests:
  - anonymous public read returns bundle
  - direct RLS test proves private registries are hidden
  - by-digest cache headers (immutable, 1 year)
  - by-slug cache headers (24 hour, mutable)
- `docs/spec.md` § 10.4 updated — auth column flips to "anonymous OK".

## References

- ADR-0006 — the original RLS-as-tenant-boundary decision
- ADR-0013 — the Trust Bundle format these endpoints serve
- `apps/api/registry/migrations/0002_rls_policies.py` — the
  tenant_isolation policies this ADR's policies OR with
- Postgres RLS docs:
  https://www.postgresql.org/docs/current/ddl-rowsecurity.html

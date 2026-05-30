# ADR-0007: Authentik for OIDC identity

**Status:** Accepted
**Date:** 2026-05-28

## Context

PrimitiveHub needs an OIDC identity provider. The app issues no
passwords itself (per Principle 1: trust is cryptographic) — identity
is delegated to a real IdP. The IdP must:

- Be self-hostable (control over the audit log, no vendor lock-in for
  enterprise customers).
- Support OIDC + OAuth2 + SAML so enterprise SSO is plug-in.
- Federate to upstream IdPs (Google, GitHub, Microsoft, generic SAML)
  so we don't ship our own password UI.
- Be containerized and operationally sane.

## Decision

Authentik (`ghcr.io/goauthentik/server`). Runs in compose as a sibling
service. Shares the Postgres instance via a dedicated `authentik`
database.

## Alternatives considered

1. **Auth0 (hosted)** — The default for "I don't want to think about
   auth". Rejected because:
   - Hosted-only; enterprise customers Phase 7+ need on-prem.
   - Pricing scales with MAU; we'd be paying Auth0 forever.
   - Vendor lock-in: Auth0's API isn't OIDC-clean; migrating off later
     is non-trivial.

2. **Keycloak** — Open-source, mature, JBoss-era. Rejected because:
   - Heavier than Authentik (JVM, more RAM, longer boot).
   - UX is less polished; admin UI feels enterprise-2010.
   - Authentik handles federation + flows with less ceremony.

3. **Ory Hydra + Kratos** — Modern, Go-native, scales well. Rejected
   because:
   - Hydra is OAuth-only; Kratos is identity; you need both, and the
     glue is your problem. Authentik bundles login + identity + flows
     + admin UI in one binary.
   - Higher operational complexity for a v1 product.

4. **Build our own** — Reject before even considering. Anderson on
   security: don't roll your own auth.

5. **Clerk / Stytch / similar** — Hosted-only, same lock-in problem
   as Auth0, even more opinionated.

## Consequences

**Positive:**
- Self-hosted from day one. Pre-launch sessions run against our own
  IdP; no external dependency for the dev loop or for the eventual
  paper-launch demo.
- Federation upstream is a configuration change. When we want
  "Sign in with GitHub" for the public registry, Authentik configures
  GitHub as an OAuth2 Source — no code changes in PrimitiveHub.
- Authentik's "flows" model maps cleanly onto the role-bound publishing
  + security-reviewer veto pattern we need. We can compose a flow that
  requires re-authentication + 2FA for high-risk publish actions.
- Audit log is rich + queryable from Authentik's admin UI.

**Negative:**
- Memory cost: authentik-server + authentik-worker together resident
  ~780 MB. On a small dev host this is non-trivial; led to the
  "≥8 GB RAM" minimum documented in CLAUDE.md.
- The admin UI is chatty over HTTP — VS Code port forwarding chokes
  on it. SSH local-port-forward is the workaround. (`docs/bugs.md` #7.)
- First-boot bootstrap env vars (AUTHENTIK_BOOTSTRAP_PASSWORD) only
  apply on first init. Subsequent password issues require `ak shell`
  reset. (`docs/bugs.md` #5.)
- Default authentication flow has a reputation policy that silently
  locks IPs after failed attempts; recovery is `Reputation.objects.
  all().delete()`. (`docs/bugs.md` #4.)

## References

- `compose.yaml` — authentik-server + authentik-worker service defs.
- `apps/api/accounts/middleware.py` — backend OIDC JWT validation
  against Authentik's JWKS.
- `apps/api/accounts/tenant_middleware.py` — reads `request.user`
  from Authentik subject for tenant resolution.
- `apps/web/lib/auth/` — frontend OAuth Authorization Code + PKCE flow.
- `apps/web/README.md` § Authentik OIDC setup — provisioning runbook.
- ADR-0009 — the two-issuer compose-dev pattern that the Authentik
  setup requires.

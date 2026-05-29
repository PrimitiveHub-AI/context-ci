# PrimitiveHub Web

Next.js 16 frontend for PrimitiveHub. See [project root README](../../README.md)
for the full dev workflow.

## Authentik OIDC setup (required for sign-in)

The Sign-in button in the navbar redirects to Authentik. Before that
flow works, Authentik needs an OIDC provider + application registered.

### One-time provisioning

1. Open the Authentik admin UI: <http://localhost:9000/if/admin/>
   - Credentials from `.env` (bootstrap admin / bootstrap password).

2. **Create an OAuth2 / OpenID Provider**
   - Applications → Providers → Create
   - Type: **OAuth2/OpenID Provider**
   - Name: `primitivehub-web`
   - Authorization flow: `default-provider-authorization-implicit-consent`
     (or any flow that completes without prompting in dev)
   - Client type: **Confidential**
   - Client ID: copy this — goes into `OIDC_CLIENT_ID`
   - Client Secret: copy this — goes into `OIDC_CLIENT_SECRET`
   - Redirect URIs: `http://localhost:3000/auth/callback`
   - Signing Key: any RSA key (Authentik provides one by default)
   - Save.

3. **Create the Application**
   - Applications → Applications → Create
   - Name: `PrimitiveHub`
   - Slug: `primitivehub` — this is the `<app-slug>` in
     `OIDC_ISSUER_URL=http://localhost:9000/application/o/<app-slug>/`
   - Provider: select the `primitivehub-web` provider you just made
   - Save.

4. **Drop the credentials into `apps/web/.env`**
   ```env
   OIDC_ISSUER_URL=http://localhost:9000/application/o/primitivehub/
   OIDC_CLIENT_ID=<paste-from-step-2>
   OIDC_CLIENT_SECRET=<paste-from-step-2>
   OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
   OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
   ```

5. **Restart the web container** so it picks up the env file:
   ```bash
   docker compose restart web
   ```

6. **Test**
   - Open <http://localhost:3000/>
   - Click "Sign in" — should redirect to Authentik, then back to /registry
   - The navbar should show your display name + a Sign out button.

### Troubleshooting

- **"Token exchange failed"** — `OIDC_CLIENT_SECRET` mismatch, or the
  Authentik provider's redirect URI doesn't exactly match
  `OIDC_REDIRECT_URI`. Compare both ends.
- **"State mismatch"** — usually the user used the browser back button
  during the flow. Click Sign in again from a clean tab.
- **/whoami returns `authenticated: false` after login** — the api
  container's `OIDC_ISSUER` doesn't match Authentik's actual issuer URL.
  Check `apps/api/.env` and the api container env.

### Production posture

In production, set `OIDC_REDIRECT_URI` to the public callback URL
(`https://primitivehub.ai/auth/callback`) and ensure
`NODE_ENV=production` so cookies are set with `Secure`. The
`.env` file is gitignored — secrets go through the deployment's secret
manager, not env files committed to git.

## Local dev (TL;DR)

```bash
# From project root
docker compose up
# Then: http://localhost:3000/
```

`pnpm` only (never npm). Type-checks: `pnpm typecheck`. Data invariant:
`pnpm check:data`.

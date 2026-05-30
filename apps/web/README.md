# PrimitiveHub Web

Next.js 16 frontend for PrimitiveHub. See [project root README](../../README.md)
for the full dev workflow.

## Authentik OIDC setup (required for sign-in)

The Sign-in button in the navbar redirects to Authentik. Before that
flow works, Authentik needs an OIDC provider + application registered.

### One-time provisioning

1. **Open Authentik admin**: <http://localhost:9000/if/admin/>
   - First-time login is `akadmin` / `AUTHENTIK_BOOTSTRAP_PASSWORD`
     from compose env. **If "Invalid password" appears even with the
     right value**, you've likely tripped Authentik's reputation
     policy; reset via:
     ```bash
     docker compose exec authentik-server ak shell -c "
       from authentik.policies.reputation.models import Reputation
       Reputation.objects.all().delete()
       from authentik.core.models import User
       u = User.objects.get(username='akadmin')
       u.set_password('<new-password>'); u.save()
       print('reset')
     "
     ```

2. **Create an OAuth2/OpenID Provider**
   - Applications → Providers → Create
   - Type: **OAuth2/OpenID Provider**
   - Name: `primitivehub-web`
   - Authorization flow: `default-provider-authorization-implicit-consent`
   - Client type: **Confidential**
   - Redirect URIs: `http://localhost:3000/auth/callback`
   - Signing Key: any RSA key (Authentik provides one by default)
   - Save. **Copy the Client ID + Client Secret immediately** — they're
     shown only on the create screen.

3. **Create the Application**
   - Applications → Applications → Create
   - Name: `PrimitiveHub`
   - **Slug**: explicitly type `primitive-hub` (or whatever slug you'll
     reference in `OIDC_ISSUER_URL`). **Authentik auto-kebab-cases the
     display name** — `PrimitiveHub` becomes `primitive-hub`, not
     `primitivehub`. Don't trust the auto-fill; verify the slug field
     after typing the name.
   - Provider: select the `primitivehub-web` provider you just made
   - Save.

4. **Drop the credentials into `apps/web/.env`** (gitignored):
   ```env
   # Two-issuer model — load-bearing for compose dev.
   # The web container reaches Authentik via the docker network hostname.
   # The user's BROWSER reaches it via the host port mapping.
   OIDC_ISSUER_URL=http://authentik-server:9000/application/o/primitive-hub/
   OIDC_BROWSER_ISSUER_URL=http://localhost:9000/application/o/primitive-hub/
   OIDC_CLIENT_ID=<from-step-2>
   OIDC_CLIENT_SECRET=<from-step-2>
   OIDC_REDIRECT_URI=http://localhost:3000/auth/callback
   OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/
   DJANGO_API_BASE_URL=http://api:8000/api/v1
   ```

5. **Recreate the web container** so the new env_file is picked up:
   ```bash
   docker compose up -d --no-deps --force-recreate web
   ```
   `docker compose restart` is NOT enough — restart reuses the
   existing container's env. Force-recreate is the reliable path.

6. **Test**
   - Open <http://localhost:3000/>
   - Click "Sign in" — should redirect to Authentik, then back to /registry
   - Navbar shows your display name + a Sign out button

### Why the two-issuer model

Without `OIDC_BROWSER_ISSUER_URL`, you'd hit one of two errors:

- `OIDC_ISSUER_URL=http://localhost:9000/...` → server-side token
  exchange fails with "connection refused". The web container's
  `localhost` is the container itself; Authentik isn't there.
- `OIDC_ISSUER_URL=http://authentik-server:9000/...` → browser hangs
  on the /authorize redirect. The host can't resolve
  `authentik-server` — that's a compose-internal name.

The split: `OIDC_ISSUER_URL` is server-facing (used for /token).
`OIDC_BROWSER_ISSUER_URL` is browser-facing (used for /authorize and
/end-session). In production with a single public hostname, leave the
override unset.

### Troubleshooting

- **"Not Found" at /authorize** — the slug in `OIDC_ISSUER_URL` /
  `OIDC_BROWSER_ISSUER_URL` doesn't match the Application's actual
  slug. Check in Authentik admin → Applications.
- **"Token exchange failed"** — `OIDC_CLIENT_SECRET` is wrong (the
  Authentik UI may have regenerated it after your initial copy), or
  the provider's Redirect URI doesn't EXACTLY match `OIDC_REDIRECT_URI`.
  Verify with:
  ```bash
  docker compose exec authentik-server ak shell -c "
    from authentik.providers.oauth2.models import OAuth2Provider
    p = OAuth2Provider.objects.get(name='primitivehub-web')
    print('client_id=', p.client_id)
    print('client_secret=', p.client_secret)
    print('redirect_uris=', list(p.redirect_uris))
  "
  ```
- **"State mismatch"** — usually the user used the browser back button
  during the flow. Click Sign in again from a fresh tab.
- **/whoami returns `authenticated: false` after a successful sign-in**
  — the api container's `OIDC_ISSUER` doesn't match Authentik's actual
  issuer URL. Check `apps/api/.env` and the api container env.
- **Authentik admin UI is slow / spinner** — usually VS Code port
  forward chokes on Authentik's many concurrent API calls. Use an SSH
  local port forward instead:
  ```bash
  # On your LOCAL machine, not in the VS Code terminal:
  ssh -L 9000:localhost:9000 -L 3000:localhost:3000 -N <server>
  ```

### Production posture

In production, set `OIDC_REDIRECT_URI` to the public callback URL
(`https://primitivehub.ai/auth/callback`), drop the
`OIDC_BROWSER_ISSUER_URL` override (browser + backend share the
public hostname), and ensure `NODE_ENV=production` so cookies are set
with `Secure`. The `.env` file is gitignored — secrets go through the
deployment's secret manager, not env files committed to git.

## Local dev (TL;DR)

```bash
# From project root
docker compose up
# Then: http://localhost:3000/
```

`pnpm` only (never npm). Type-checks: `pnpm typecheck`. Data invariant:
`pnpm check:data`.

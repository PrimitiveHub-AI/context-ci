"""Public `/check` paste-and-verdict lookup surface.

This app exposes a single anonymous endpoint (`POST /api/v1/check`)
that lets any browser or client paste raw content, a URL, or an `npx`
coordinate and get back a Context CI Top 10 verdict.

It is the AV-product-family "cloud lookup" row of ADR-0030 § 3,
upgraded from the digest-only Trust API (ADR-0013) to a paste-anything
browser surface. See ADR-0034 for the full contract.

This app is stateless: no models, no migrations, no Procrastinate
tasks. Rate-limiting state lives in Valkey. Scanned content is never
persisted.
"""

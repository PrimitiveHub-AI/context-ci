# Runtime Trust API — agent integration

**Status:** Brainstorm (not yet committed to roadmap)
**Date:** 2026-05-30
**Owner:** mhm
**Maturity:** strategic concept, technically tractable, not yet scoped to phases

> **What this document is:** A working brainstorm + adversarial critique of
> the most strategically important idea we've discussed in this project so
> far. Not a plan. Not an ADR. A thinking artifact, written so we can
> argue with it later instead of re-deriving it.

---

## The idea, stated plainly

PrimitiveHub should expose a **runtime trust API** that AI agents
(Claude Code, Cursor, Copilot, Aider, custom MCP-using agents) call
during task execution to:

1. **Discover** primitives by name / category / capability
2. **Fetch** the content, verified
3. **Verify** the cryptographic attestation (Sigstore cert chain +
   Rekor inclusion proof + Context CI verdicts) offline
4. **Refuse** to use primitives whose Context CI verdict is FAIL

Three delivery shapes, ranked by reach:

| Shape | Audience | Reach |
|---|---|---|
| **MCP server** (`primitivehub` MCP) | Claude Code, Cursor, anyone speaking MCP | High (Anthropic's open standard) |
| **HTTP API** (`GET /trust/<slug>@<semver>`) | Any agent / language / tool | Universal |
| **CLI + library** (`phub`, `primitivehub` Python/TS lib) | Scripts, CI pipelines, custom agents | High for developer-touch |

All three are the SAME underlying API; just different transports.

---

## Why this is strategically the biggest idea in the project

Every PR shipped so far has made PrimitiveHub more *correct*. This idea
makes PrimitiveHub more *necessary*. The difference between hobby and
infrastructure.

Without it, PrimitiveHub is a website where humans browse primitives —
indexed by a registry, signed by Sigstore, validated by Context CI.
Useful. Inert.

With it, PrimitiveHub becomes the **runtime trust layer** that every
agent queries before consuming context. Now we're not competing with
Anthropic Skills / OpenAI plugins / Cursor Rules — we're the layer
they all CONSUME. **Like how every package manager pings npmjs.org.**

This is the difference between:

- "the GitHub of AI primitives" (positions us as a destination)
- "the runtime trust API that AI agents call to verify their context"
  (positions us as infrastructure)

Infrastructure compounds. Destinations don't.

### The vendor-absorption hedge

I earlier flagged the risk: Anthropic/OpenAI/Cursor each shipping their
own vendor-locked skill registries makes us redundant. The runtime
trust API neutralizes that:

> PrimitiveHub doesn't have to be the only registry. It can be the
> **verification overlay** on TOP of any source.

A skill comes from Anthropic Skills? Fine. PrimitiveHub-Trust takes
its sha256, looks up the attestation, returns "Context CI: FAIL on T1
(prompt-injection in line 14)." The agent refuses.

This is the **Snyk play**, not the **GitHub play**. Snyk doesn't host
your code — it verifies it. Snyk became infrastructure precisely because
it sat one layer above the actual source. PrimitiveHub-Trust does the
same for AI context.

---

## Technical sketches

### The MCP server (highest leverage)

```jsonc
// In a user's .claude/mcp.json or cursor settings
{
  "mcpServers": {
    "primitivehub": {
      "command": "npx",  // <-- ironically; or `phub-mcp` after CLI ships
      "args": ["@primitivehub/mcp-server@1"],
      "env": {
        "PRIMITIVEHUB_REGISTRY_URL": "https://primitivehub.ai",
        "PRIMITIVEHUB_TRUST_POLICY": "require-trusted",
        "PRIMITIVEHUB_OFFLINE_CACHE": "~/.cache/primitivehub"
      }
    }
  }
}
```

Tools the server exposes to the agent:

- `primitivehub.search(query)` → list of matching primitives + attestation status
- `primitivehub.fetch(slug, semver?)` → content + attestation, refuses if FAIL
- `primitivehub.verify(content, attestation)` → boolean + diff hints (offline)
- `primitivehub.attest(content)` → submit user-authored primitive for signing

### The HTTP API

```http
GET /api/trust/elite-mobile-design@1.2.0
Accept: application/vnd.primitivehub.bundle+json
```

Response includes:
- Primitive content (markdown bytes)
- Full sigstore Bundle (cert chain + signature + Rekor inclusion proof)
- Context CI verdicts (`validation[]` block from the attestation predicate)
- Sufficient material for **offline verification** — the agent doesn't
  need to call Rekor again, the bundle has the inclusion proof

```http
GET /api/trust/by-digest/sha256:abc123...
Accept: application/vnd.primitivehub.bundle+json
```

Lookup by digest. This is **the overlay-on-other-registries play.** An
agent that fetched content from Anthropic Skills computes its sha256,
asks PrimitiveHub-Trust "what do you know about this hash?" — and gets
back the attestation if we've signed it, or a 404 if we haven't.

### The CLI + library

```bash
$ phub use elite-mobile-design
✓ fetched elite-mobile-design@1.2.0 (4.1 KiB)
✓ Sigstore cert: alice@example.com via Authentik (issued 2026-04-12)
✓ Rekor entry: logIndex=18234567 (sigstore.dev)
✓ Context CI: 10/10 passed
✓ Cached at ~/.cache/primitivehub/elite-mobile-design@1.2.0
✓ Linked into ./.claude/skills/

$ phub verify ./some-random-primitive.md
✗ No attestation found for sha256:b7f4...
  Hint: this file does not match any signed primitive in primitivehub.ai
  To submit it for signing: `phub publish ./some-random-primitive.md`
```

Library equivalents in TypeScript + Python so agents can build it in.

---

## Adversarial critique — the hard parts

### 1. Latency on the critical path

Every agent task that consumes a primitive now does at least one HTTP
round-trip to primitivehub.ai. If we're slow, every prompt is slow.

**Mitigations:**
- **CDN.** Cloudflare R2 already serves at edge; the API/JSON layer
  can ride the same CDN.
- **Offline cache.** Default behavior: first fetch hits the network;
  subsequent fetches read `~/.cache/primitivehub` and re-verify the
  cached bundle offline.
- **Pre-fetch pattern.** `phub pull --bundle frontend-essentials`
  pulls + verifies a curated set; the agent then runs entirely offline.

**Residual risk:** if the agent's task triggers a fetch of an unseen
primitive mid-task, latency is real. Maybe 100-300ms p50 from Hetzner
+ Cloudflare. Tolerable, but not zero.

### 2. Cache invalidation

If a primitive gets a v1.2.1 with a security fix, when does the agent
see it? Three policies:

- **Pin-by-digest.** Agent caches by sha256 forever. Updates require
  user action. SAFE but stale.
- **Pin-by-semver.** Cache TTL = 24h on the slug → digest mapping.
  Agent gets the new version within a day. Acceptable for most cases.
- **Always-fresh.** Every fetch hits the network for the latest
  digest, then re-uses cached content if the digest matches. Best of
  both worlds. Adds one round-trip per fetch but no content download.

**Recommendation:** ship with **always-fresh as default**, pin-by-digest
as an opt-in for security-sensitive shops.

### 3. Trust on first use

The first time the agent's machine talks to primitivehub.ai, how does
it know the response is genuine and not MITM'd? The Sigstore bundle is
self-contained, but only if the agent has the SIGSTORE TRUST ROOT.

**Mitigations:**
- The MCP server ships with the public Sigstore trust root bundled.
  TUF (The Update Framework — already used by Sigstore) handles trust
  root rotation.
- For self-hosted enterprise: operator provides their own trust root.
- For air-gapped: snapshot the trust root at deploy time, rotate on
  schedule.

This is a solved problem in the supply-chain world. We're not inventing
anything; we're just using TUF + Sigstore the way they were designed.

### 4. Vendor adoption is not free

For "Claude Code installs PrimitiveHub MCP by default" to happen,
Anthropic has to want it. They may prefer their own first-party
Skills registry.

**Counter-strategy:** make it ONE COMMAND for users to add, even
without vendor blessing.

```bash
$ claude mcp add primitivehub
✓ Added PrimitiveHub MCP server to ~/.claude/mcp.json
```

If the value is real, users add it. If users add it en masse, vendors
notice. Then default adoption becomes a question of timing, not
permission.

### 5. Privacy

Every fetch tells PrimitiveHub "agent X used primitive Y at time Z."
That's surveillance-grade telemetry by default.

**Mitigations:**
- **No identifying headers on fetch.** No User-Agent that includes
  user ID. No cookie. No bearer token unless you're publishing.
- **Anonymous reads.** Public registry primitives are CDN-cached;
  reads don't even hit our origin.
- **Opt-in analytics.** Users can enable "share my usage so authors
  see what's popular" — explicitly off by default.
- **Self-host.** Enterprises run their own PrimitiveHub instance;
  no data leaves their perimeter.

### 6. Offline-first agents

Many developer agents work on planes, in tunnels, in air-gapped envs.
Pulling at runtime breaks that.

**Mitigations:**
- **Pre-fetch + cache.** `phub sync` pulls a curated set; agent reads
  from cache thereafter.
- **Offline verify.** The bundle has the inclusion proof; verification
  doesn't need Rekor at runtime.
- **Graceful degradation.** If the network is unreachable, agent
  falls back to cached content + a clear "this primitive was last
  verified 2 days ago" notice.

### 7. MCP coupling risk

MCP is Anthropic-driven. If they pivot, fork, or deprecate the
protocol, we're exposed.

**Mitigation:** the MCP server is a THIN SHIM over the HTTP API. The
HTTP API is the canonical contract. If MCP dies, we lose the
plug-and-play UX but the API survives. Build MCP support in parallel
with the HTTP API, never as the only transport.

### 8. The "what about MCP servers that ARE primitives?" question

MCP servers themselves can be malicious. If PrimitiveHub becomes
known as the trust layer for AI context, users will ask: "can I trust
the MCP servers I install? Will PrimitiveHub verify them too?"

This is **Phase 11+ scope** — federation + cross-registry trust. The
HTTP API hashes-by-digest design naturally extends: an MCP server's
manifest is a markdown-ish document; we can run Context CI on it.

---

## Steel-manning the "this is a bad idea" view

Let me argue against my own enthusiasm:

1. **MCP adoption could stall.** It's nine months old. Real-world
   usage is still small. Building heavily on it bets on Anthropic's
   continued investment.

2. **Vendors may bundle their own trust.** Anthropic could ship
   first-party Context CI inside Claude Code, making external trust
   layers redundant for their users. Same risk for OpenAI / Cursor.

3. **Enterprise customers prefer internal registries.** Big shops
   run JFrog Artifactory or internal mirrors. Their version of
   "PrimitiveHub" is their internal registry; we'd be IRRELEVANT to
   the runtime fetch unless we sell them the software.

4. **Latency really IS bad for AI workflows.** Agent latency budgets
   are measured in milliseconds. Adding 100ms per primitive fetch
   could be the difference between adopting and not.

5. **Trust is hard to *sell* at runtime.** Users don't notice when
   verification works. They notice when it blocks. We could become
   the "annoying gatekeeper" rather than the "trusted infrastructure."

**My counter to all of those:** all of those concerns reduce to
"adoption will be hard." That's true of every infrastructure product.
The fact that adoption is hard is not a reason to not build the right
thing. It's a reason to build it well + market it relentlessly.

---

## What I recommend, ranked

### High confidence

1. **Build the HTTP API first.** `GET /api/trust/<slug>@<semver>` +
   `GET /api/trust/by-digest/<digest>`. This is the canonical contract.
   Everything else is a transport over it.

2. **Bundle-format spec.** Define `application/vnd.primitivehub.bundle+json`
   (content + Sigstore bundle + Context CI verdicts) as a stable schema.
   Other registries can produce this format too; we become the spec
   author.

3. **Library + CLI before MCP server.** A `phub` CLI that verifies
   downloaded primitives is useful even without runtime agent integration.
   Ship it first; the MCP server piggybacks.

### Medium confidence

4. **MCP server as the next milestone.** Once HTTP API + CLI are
   solid, the MCP server is a thin wrapper. Ship it. Submit to the
   MCP server registry. Distribute via `npx @primitivehub/mcp-server`.

5. **The verification-overlay positioning.** Lead with "PrimitiveHub
   doesn't have to be the only registry — it can be the verifier on
   top of any registry." This is the wedge that survives vendor
   competition.

### Lower confidence (worth doing, but with more caveats)

6. **Open the spec.** Publish `context-ci-bundle-v0.1.md` as an open
   standard. Invite other registries to attest in the format. Hugging
   Face, npm, etc. could adopt without using our infrastructure. We
   win mindshare even if they never use our servers.

7. **Free OSS verifier library.** `pip install context-ci-verify` or
   `npm install context-ci-verify`. Free. Verifies any bundle.
   Distribution moat: every shop that uses it is one click from using
   our registry.

---

## What this changes about the roadmap

This isn't an immediate scope change. Phase 4 is shipping. Phase 5 is
in progress. But it suggests a **Phase 5.5 or Phase 6 reordering**:

| Current roadmap | Suggested shift |
|---|---|
| Phase 6 (Marketplace + search + reviews) | Push to Phase 7 |
| Phase 7 (Enterprise self-host) | Keep as Phase 7 |
| **Phase 5.5** (new — Runtime Trust API) | Insert between Phase 5 and Phase 6 |

Phase 5.5 contents:
1. Bundle-format spec → `docs/spec.md` § Bundle
2. HTTP API endpoints (`/api/trust/*`)
3. `phub` CLI MVP (`fetch`, `verify`, `cache`)
4. `context-ci-verify` OSS library (Python + TS)
5. MCP server (`@primitivehub/mcp-server`)
6. Documentation: "Verify any primitive offline in 30 seconds"

This would let us **launch with two artifacts**:
- The registry website (primitivehub.ai) — the destination
- The verify library (`context-ci-verify`) — the infrastructure

That's a much stronger launch than the registry alone.

---

## Open questions for the next conversation

1. **Is "verification overlay on other registries" the right
   positioning?** It's stronger than "we're another registry" but
   weaker than "we're the only registry." Worth workshopping with
   real users.

2. **Should we publish `context-ci-verify` as a SEPARATE OSS repo
   right now, before the launch?** Argues for: distribution head start.
   Argues against: pre-launch posture; can't promote until paper drops.

3. **How does the runtime trust API interact with private primitives?**
   For enterprise self-hosted users, the API is internal — easy. For
   the public registry, what about private orgs? Need an auth layer.

4. **What's the right relationship between PrimitiveHub.ai (the
   product) and Context CI (the standard)?** Strategic question I
   raised earlier. Worth deciding before any public artifact ships.

5. **MCP first or HTTP first?** I argued HTTP — MCP rides on top. But
   if MCP gets us into Claude Code by default faster, that might be
   worth inverting.

---

## Links

- `docs/positioning.md` — current competitive frame; this idea may
  warrant a rev
- `docs/vision.md` — north star; doesn't currently mention runtime
  trust; consider amending
- `docs/spec.md` — Bundle format would live here
- ADR-0011 — Sigstore backend abstraction; the bundle this API
  returns is exactly the one we already build
- ADR-0012 — Detector Protocol; the verdicts are exactly the
  `validation[]` block this API exposes

**The infrastructure we've already built makes this API a thin layer.**
The hard work is the spec + adoption, not the implementation. That's
the right shape for an "innovation we should build."

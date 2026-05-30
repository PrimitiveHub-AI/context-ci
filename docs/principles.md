# PrimitiveHub Principles

> **Status:** These are the beliefs the project ships against. Adding a
> principle requires deliberation; changing one requires the maintainer's
> sign-off; removing one requires written justification.

## 1. Trust is cryptographic or it doesn't exist

Every "Trusted" claim is backed by an attestation that can be verified
against a transparency log. We do not display badges, scores, or trust
indicators that aren't recomputable from first principles. The
`<DemoDataBadge>` exists precisely to make demo-only metrics visually
distinguishable from real ones — a metric without provenance is wearing
a mark of dishonor by design.

## 2. The spec is the contract

Primitive Spec v0.1, the Attestation predicate, the threat model, the
cryptographic vocabulary — these are published, versioned, and open.
The product implements the spec; the spec is the product. When the
implementation and the spec disagree, the spec is right.

## 3. Postgres is the truth

Search indexes lag. Caches go stale. Analytics rollups smudge.
**Postgres is the source of truth for every record that bears trust
weight.** Every other surface is derived state, rebuildable from
Postgres. If we lose Postgres, we lose the product; if we lose
anything else, we rebuild it from Postgres.

## 4. Tenant isolation is non-negotiable, at every layer

Application queryset scoping. Postgres Row-Level Security with a
non-superuser app role. Authentication via OIDC. Authorization
verified independently from authentication. RLS-integration test that
proves the policy enforces at the DB layer. **All four layers, on
every protected endpoint, every time.**

## 5. Security is socio-technical

Anderson is right. The hard problem isn't crypto; it's the human +
organizational + economic system around crypto. We design for compromised
authors, insider reviewers, typosquat-attempting strangers, and bored
employees with admin tokens. The threat model treats opponents as a
class, not as a single archetype.

## 6. Restraint over chrome

Borrowing from Stripe / Vercel / Linear / Sigstore: serious
infrastructure reads as serious. Color, weight, motion, density —
everything quiet by default; everything loud only when content
demands. The product is the data, not the wrapper.

## 7. No hallucinations as fact

Every metric on a UI surface is reproducible OR labeled `<DemoDataBadge>`.
Every primitive's content is verifiable OR not yet attested. Every claim
the product makes about itself can be replayed by a third party. If a
number on the screen can't be derived, it doesn't ship.

## 8. Failure-mode-first design

For every endpoint, ask: what asset, what opponent, what failure mode?
For every mutation, ask: what's the idempotency key? For every external
call, ask: what's the timeout? For every cache write, ask: when does
this invalidate?

## 9. Reviewability is the work

A PR you cannot review is technical debt the day it merges. We split
large work into reviewable chunks. We write commit messages that
explain WHY. We surface risks honestly, including in our own work.
Velocity that lands unreviewable code is anti-velocity.

## 10. Open-source by intent

The Primitive Spec, the threat model, the validator implementations,
and the scanner suite are open-source. The hosted registry is the
commercial wrapper. Open source is the trust signal; the hosted
service is the convenience.

## 11. Pre-launch posture is absolute

No public deploys. No social posts. No domain references in indexable
surfaces. `noindex` defenses (robots.txt + meta + X-Robots-Tag) on
every page. Until the paper publishes, we are silent. This is not
about secrecy for its own sake — it's about controlling the moment of
first impression.

## 12. Containerized everything

Every service runs in Docker. No host installs. Dev = `docker compose
up`. Production = the same image stream. We never ship "works on the
maintainer's laptop"; we ship "works in a container that can be torn
down and rebuilt in 90 seconds".

## 13. Localhost-only in dev, always

Every dev server binds to `127.0.0.1`. No `0.0.0.0` bindings in dev,
ever. Pre-launch posture is absolute (see Principle 11) and starts at
the port mapping.

## 14. pnpm only

The frontend uses pnpm. Lockfile discipline matters; mixed managers
break it. We do not run `npm install`.

## 15. Held code is not dead code

If a comment says `HELD for Phase X`, or a file lives under `_drafts/`
or `staged/` or `scanners_held/`, it is staged for a known future use.
We do not delete it because the other side hasn't landed yet.

## 16. The next phase is not yet

When the spec changes, we ratchet the version. When a primitive grows
a new field, we ratchet `version: 0.X.Y`. When the threat model grows
a new category, the previous version stays citable. We do not silently
mutate published surfaces.

## 17. Document the WHY, not the WHAT

Code shows what it does. Comments, commit messages, ADRs, README
sections show why it does it that way. Future-me reading this in six
months should learn the reasoning, not re-derive it.

## 18. Honest about what we don't know

When a piece doesn't ship green, we say so. When a flow has a known
gap, we document it. When a fix is a workaround and not a root-cause
fix, we name it as such. Trust the maintainer with the truth; they're
the only one who can decide what to do with it.

## How to use these

When you're about to write code, ship a feature, draft copy, or make a
design call — read the list. If your work conflicts with a principle,
either (a) revise the work, or (b) surface the conflict and propose
revising the principle. Don't quietly ship against the principle.

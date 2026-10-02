---
name: feedback-extract-reusable
description: "Active extraction evaluation — for every component, helper, or API client, consciously judge whether similar concepts warrant a reusable component / SDK / shared module. Never bypass the evaluation."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e0b666dc-0a98-48ff-a84f-af00dea7cd94
---

For every component I write — UI component, helper function, API client, backend service, validation rule, type — I must **consciously evaluate** whether similar concepts already exist (or are emerging) in the codebase that should be unified into a reusable component, SDK, shared module, or abstraction. **This evaluation is mandatory; the answer is not always "extract."** What is non-negotiable is that I run the check.

**The evaluation (run every time):**

1. **Scan for siblings.** Before writing, grep for similar names, similar shapes, similar responsibilities. Examples: a second `PrimitiveCard`-shaped surface → check `components/ui/`; a second R2 client call → check `apps/api/storage/`; a second Sigstore backend → check `apps/api/signing/` (ADR-0011 already did this); a second scanner → check `apps/api/scanners/`.
2. **Apply the rule of three with intent.** Two near-identical sites = note it. Three = extract. But also extract earlier when the concept is load-bearing (signing, attestation, tenant scoping, content addressing) because divergence there is a correctness/security risk, not just churn.
3. **Pick the right shape.** React component vs. hook vs. utility; Django mixin vs. service module vs. Ninja router helper; backend Protocol (like `SigstoreBackend`) vs. function. The shape follows the consumer pattern — don't default to one form.
4. **Name it for the concept, not the first caller.** A helper named after the page that birthed it will not get reused. Name from the domain (`ContentDigest`, `TenantScopedQuerySet`, `AttestationTimeline`) not the caller.
5. **If NOT extracting, say why in one line** (in the PR description or a one-line comment if the duplication looks deliberate). Silent duplication is the failure mode this principle prevents.

**Why:** PrimitiveHub is a registry whose value proposition is *trust through uniformity*. Two slightly different signing paths, two slightly different tenant filters, two slightly different content-digest functions are exactly the divergence the threat model warns about — they are how supply-chain bugs get in. The bias toward extraction here is higher than in a typical product codebase because correctness is the product. ADR-0011 (Sigstore backend abstraction) is the canonical worked example: four backends behind one Protocol, one env var swaps them, the call sites never branch.

**How to apply:**
- **Frontend:** Before adding a `.tsx` to `apps/web/components/`, check `components/ui/` and `components/primitives/` for an existing component with the same role. If a new variant is needed, prefer extending the existing component via CVA variants over forking it.
- **Backend:** Before adding logic to a Ninja endpoint, check `apps/api/<app>/services/` or sibling modules for an existing service. Cross-cutting concerns (tenant scoping, RLS session vars, attestation predicate building, content addressing) belong in shared modules — never inlined in a view.
- **Scanners (Phase 5):** Every new scanner must conform to the scanner Protocol the moment a second scanner exists. Don't let two ad-hoc scanners drift.
- **Signing:** All signing flows through `signing/` (ADR-0011). Never sign inline elsewhere.
- **External SDKs:** If we wrap a third-party SDK (R2, Sigstore, Authentik) more than once, the wrapper goes in a single module and the call sites use that module, not the raw SDK.

**Tension with "no premature abstraction":** The general system instruction says three similar lines beats a premature abstraction, and that still applies — don't extract on the first occurrence and don't invent abstractions for hypothetical reuse. The discipline here is: **run the check every time**, then choose. The failure mode is skipping the check, not the occasional decision to inline.

Related: [[feedback-audit-methodology]], [[feedback-self-audit]], [[feedback-bloat-control]], [[feedback-priority-stack]]

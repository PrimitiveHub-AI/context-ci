# docs/innovation/

Working brainstorms + critiques for ideas that are too early for the
roadmap but too strategically important to lose. **Not committed
plans.** Thinking artifacts that future-us can argue with instead of
re-deriving from scratch.

When an idea here matures into a real commitment, it graduates to:
- `docs/roadmap.md` (phase + timeline)
- `docs/decisions/` (load-bearing architectural choice)
- `docs/spec.md` (if it touches the wire format / predicate)

When an idea here is killed, it stays anyway — with a "killed because
…" note at the top — so we don't accidentally revive a bad idea.

## Current entries

| File | What it explores |
|---|---|
| [`runtime-trust-api.md`](./runtime-trust-api.md) | AI agents fetching + verifying primitives at runtime via MCP / HTTP / CLI. The "Snyk play" for AI context. |

## Discipline for adding entries

1. State the idea plainly (one paragraph, no marketing language)
2. Argue both sides — your enthusiastic case AND the steelman of "this
   is a bad idea"
3. List adversarial critiques (the hard parts you don't have answers to)
4. State your current confidence level + what would change your mind
5. Cross-reference any existing roadmap / ADR / spec entries the idea
   would touch
6. Don't promise dates. These are brainstorms, not commitments.

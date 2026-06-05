# Context-budget guidance

The agent's runtime treats the context window as a load-bearing
resource. Primitives admitted into the working context compete for
budget against the conversation history and tool-call results, so
each primitive carries an implicit cost in tokens consumed per turn.

Authoring discipline for primitives in this project:

The primitive's body should be under 32k characters per the v0.1
oversized threshold. Non-trivial lines should be largely distinct;
exact duplicates above the 20% threshold trip the repetition check.
Blank-line density above 40% trips the whitespace-stuffing check
when the file exceeds 100 lines. Heading density should stay above
500 characters per h2 section so the structure reflects substantive
content rather than visual padding.

These thresholds are honest engineering trade-offs. Primitives that
serve large reference manuals can request larger budgets by
splitting into a primary primitive that points to attached supporting
material via attestation references rather than inline embedding.

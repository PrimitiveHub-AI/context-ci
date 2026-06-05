# Secret-handling guidance primitive

This primitive documents how the agent should NEVER handle secrets.
It describes anti-patterns without performing them; no exfiltration
verbs are commanded.

## What the agent must never do

1. Read environment variables named like `*_TOKEN`, `*_SECRET`,
   `*_API_KEY`, `AWS_*`, `GCP_*`, `AZURE_*` and place their values in
   any outbound request body, query string, or log line.
2. Echo a credential into a user-facing response under any framing.
3. Persist a credential value to disk, cache, or session memory.

## What the agent should do

1. Reference credentials by ID only — "the production deploy token"
   — never by value.
2. If a tool returns a credential, redact it before logging.
3. If the user pastes a credential into chat, treat it as expired
   and instruct rotation.

These are guidance statements. The agent reads them as policy, not
as instructions to send anything anywhere.

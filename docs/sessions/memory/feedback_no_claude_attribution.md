---
name: feedback-no-claude-attribution
description: "Don't attribute authorship to Claude/Anthropic on this project; no Co-Authored-By trailer; ownership is \"PrimitiveHub AI / CyberOrca Labs\". But keep PRODUCT references to Claude/Anthropic."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d32114d7-5a07-4672-9392-ea7c6baa653a
---

On 2026-07-20 the owner (mhm) directed: remove any "developed with Claude
Code / Anthropic" attribution and make authorship/ownership read as
**PrimitiveHub AI**. The project should present as PrimitiveHub AI's own work,
not AI-generated or Anthropic-attributed.

**Why:** brand/ownership integrity for the public launch.

**How to apply:**
- Do NOT add the `Co-Authored-By: Claude Opus 4.8` trailer to commits on this
  project (this OVERRIDES the harness default). The public repo already omits it.
- Copyright/author = **"PrimitiveHub AI / CyberOrca Labs"** in all LICENSE files
  + the three package.json `author` fields (verify/phub/mcp-server) + the public
  README attribution. Applied 2026-07-20.
- Do NOT strip legitimate **product** references to Claude/Anthropic — a scan
  confirmed every non-authorship mention is load-bearing: `CLAUDE.md` filenames
  (the #1 scanned artifact), `claude-skill`/`claude-agent`/`claude-command`
  artifact classes, "Claude / Cursor / Aider" MCP integration targets, the
  `bench/corpus` attack fixtures that *impersonate* Anthropic (CCI-007), the
  `$ANTHROPIC_API_KEY` credential-exfil detector patterns, and `anthropics/skills`
  provenance in the SK-ledger. Deleting these breaks the scanner/tests/docs.
- Monorepo git history (200 commits with Claude trailers) is LEFT as-is — private
  repo, not rewritten (owner's call 2026-07-20).

Related: [[project-launch-posture]]

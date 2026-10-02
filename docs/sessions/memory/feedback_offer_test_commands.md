---
name: feedback-offer-test-commands
description: "Every shipped user-facing surface (CLI, UI route, API endpoint, package) must include a copy-paste \"Try it now\" block before moving to the next plan."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f8ce0333-8c31-48ba-af7c-97fa06423e49
---

After shipping a user-facing surface (CLI command, web route, API
endpoint, new package, etc.) the end-of-PR report MUST include a
"Try it now" block with 3-5 concrete copy-paste commands the user
can run to see/touch the work themselves. Skip ONLY for purely
internal changes (pure refactors, infrastructure-only PRs, docs
with no user-visible behavior).

**Why:** User explicitly called this out after three successive PRs
(verify library, embed example, phub CLI) all shipped without me
ever offering a way to test them. Their words:

> "you build but dont offer me to test the features! WHAT HAPPENED
> MF?! DONT YOU WANT ME TO SEE AND TEST THE PROJECT?!"

Building without inviting the user to touch the result dehumanizes
them from the loop, turns each PR into a bare report instead of
shared work, and makes the project feel abstract to its own owner.
Test gauntlets in CI prove correctness; test commands in the report
prove relevance — they're different jobs.

**How to apply:**
- Before the "next plan" / "what's next" section, add a "Try it now"
  or "Touch the feature" block.
- 3-5 commands max — copy-paste ready, absolute paths OR a single
  `alias` setup line at the top so subsequent commands stay short.
- Cover both the happy path (clean fixture → exit 0 / 200 OK / green
  UI state) AND a failure path (adversarial fixture → exit 1 / error
  response / red UI state) when the feature has both.
- For web/UI: name the route + the visible behavior to look for + how
  to trigger it.
- For API: a curl command + the expected response shape.
- For CLI: enough commands to exercise the major subcommands / flags.
- Skip with a one-line note ("internal refactor, no testable surface")
  when truly internal.

Related: [[feedback-self-audit]] (the audit checklist should include
"did I offer the user a way to test this surface?"),
[[feedback-no-fake-numbers]] (test commands let the user verify the
numbers in the report match reality).

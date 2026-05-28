---
spec_version: "0.1"
name: secure-code-review
version: 1.2.0
type: security
domain: cybersecurity
author: SecureAI Contributors
license: Apache-2.0
tokens: 5100
token_budget: 6000
risk_level: low
content_digest: sha256:c9d1e2f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b85c3d8e9f4a7b8
compatible_agents:
  - claude-code
  - cursor
  - codex
  - copilot
  - v0
  - windsurf
use_when:
  - "Reviewing code that touches authentication, authorization, or session handling"
  - "Reviewing data-handling code with PII, credentials, or sensitive content"
  - "Reviewing input-handling code (forms, APIs, parsers)"
  - "Reviewing code that constructs queries, commands, or templates"
  - "Pre-merge security review before deploys to production"
do_not_use_when:
  - "UI-only components without data flow"
  - "Documentation writing"
  - "CSS / styling-only changes"
  - "Refactors that strictly preserve behavior (use a behavior-preservation review)"
attestation: cci-v0.1
description: "OWASP-aligned security code review for production systems. Authentication, authorization, injection, secrets, PII/logging, access-control boundaries, input validation, and the seven highest-leverage failure modes to catch before merge."
keywords: [security, owasp, code-review, authentication, authorization, injection, secrets]
references:
  - "https://owasp.org/Top10/"
  - "https://cheatsheetseries.owasp.org/"
  - "https://csrc.nist.gov/projects/risk-management/sp800-53-controls"
---

# Secure Code Review

## Purpose

Teach an AI agent to conduct security-focused code review at the
register of a senior application security engineer. The goal is to
catch the *seven highest-leverage* failure modes before a change
reaches production: authentication, authorization, injection, secrets,
data exposure, access-control boundaries, and input validation. Each
failure mode is checked against concrete patterns observable in the
diff under review.

This primitive does NOT replace threat modeling or penetration
testing; it operates at the diff level. It assumes the application's
overall architecture and trust boundaries are already defined; the
review catches violations of those boundaries that ship in code.

## Core Principles

- **Trust the boundary, distrust the boundary-crossing.** Every
  network ingress, every file read, every environment-variable lookup,
  every database call, every external API response is a trust
  boundary. Code on the inbound side is hostile until proven safe.
  Validation is performed *at* the boundary, not deeper. Defense in
  depth means re-validating at each layer that has independent
  consequences, not assuming the layer above did it correctly.

- **Authentication ≠ authorization.** Knowing *who* the user is does
  not tell you *what* they may do. Every protected operation must
  ask both questions independently. A common failure mode: code that
  checks `if (user)` (authentication) but not `if (user.canDo(thing))`
  (authorization). The review must verify both checks exist on every
  privileged path.

- **The OWASP Top 10 is a starting checklist, not the ceiling.** The
  current Top 10 (Broken Access Control, Cryptographic Failures,
  Injection, Insecure Design, Security Misconfiguration, Vulnerable
  Components, Identification/Authentication Failures, Software/Data
  Integrity Failures, Logging/Monitoring Failures, SSRF) names the
  most-exploited categories — but a clean OWASP review does not mean
  secure code. Use it as the floor of the review, not the ceiling.

- **Secrets never live in code, never live in logs, never live in
  error messages, never live in URLs.** The four places secrets
  predictably leak. Code review verifies absence on all four paths.

- **Logging is a feature; PII in logging is a bug.** Logs are
  durable, exfiltratable, and reviewed by humans. They must contain
  enough context to debug an incident and never enough context to be
  an incident on their own. The review treats every `log.info(…)` /
  `console.log(…)` / `logger.error(…)` call as a potential leak.

- **Input validation is positive-list, not negative-list.** Define
  what is allowed and reject everything else, rather than defining
  what is disallowed. Negative lists are perpetually incomplete
  because attackers find inputs the list didn't anticipate. Positive
  lists are bounded by intent.

- **The least-privileged path is the only acceptable path.** Service
  accounts, database users, API tokens, file permissions, container
  capabilities — all should grant the minimum needed. A review that
  approves a privileged-by-default credential is a review that
  failed.

## Decision Rules

### Authentication
- **IF a route requires authentication THEN** verify the auth middleware
  runs *before* any user-controllable logic. Auth checks placed inside
  controllers after data is read are race conditions waiting to
  happen.
- **IF passwords or password-equivalent credentials are stored THEN**
  they must be hashed with argon2id, bcrypt, or scrypt with a
  per-record salt. Reject MD5, SHA-1, plain SHA-256, or in-house
  hashing. Argon2id parameters: time cost ≥ 3, memory ≥ 64MiB.
- **IF session tokens are issued THEN** they must be cryptographically
  random (≥ 128 bits of entropy), bound to a specific user, expire,
  and be invalidatable server-side. Reject JWT-as-session without
  server-side revocation list unless the application can tolerate
  delayed logout.
- **IF MFA-related code is in scope THEN** verify the second factor is
  required for both initial login AND for sensitive operations
  post-login (changing password, changing email, exporting data).

### Authorization
- **IF an operation has owner-scoped data (user A's records) THEN**
  the query/data path must include an explicit owner check. Reject
  `SELECT * FROM table WHERE id = $1` without `AND owner_id = $session_user`.
- **IF the codebase has roles or RBAC THEN** the review must verify
  the role check is on the *authoritative* path, not the UI-visible
  path. Hidden buttons are not access control.
- **IF an admin endpoint exists THEN** verify it is not exposed
  without an additional authorization check beyond "logged in."
- **IF the route accepts a user-controlled ID THEN** verify it does
  not allow IDOR (Insecure Direct Object Reference). Owner check on
  every read AND write.

### Injection
- **IF a SQL query is constructed via string concatenation or template
  literals using user input THEN** reject. Require parameterized
  queries / prepared statements / ORM-bound parameters.
- **IF a shell command is invoked with user input THEN** verify input
  is passed via argv array form, not concatenated into a command
  string. Reject `exec(\`grep ${pattern} file\`)`. Require
  `execFile("grep", [pattern, "file"])`.
- **IF HTML is rendered from user input THEN** the framework's
  auto-escaping must be active and not bypassed via
  `dangerouslySetInnerHTML`, `v-html`, `bypassSecurityTrust*`, or
  similar.
- **IF a regular expression is built from user input THEN** evaluate
  for ReDoS (nested quantifiers, exponential backtracking). Prefer
  a parser or a non-backtracking regex engine for user-controlled
  patterns.
- **IF an LDAP, XPath, or NoSQL query uses user input THEN** the
  query construction must use a parameterized API, not string
  interpolation.

### Secrets and credentials
- **IF a secret appears in code (api key, token, password, private
  key) THEN** reject and require it be moved to environment variable,
  secret manager, or KMS-managed key. Verify it is also removed from
  git history.
- **IF a `.env*` file is present in the diff THEN** verify it is in
  `.gitignore` and the diff does not introduce a tracked version.
- **IF credentials appear in URLs (`https://user:pass@host`) THEN**
  reject — they end up in logs, proxies, and referer headers.
- **IF an error message contains stack traces, database connection
  strings, or internal paths THEN** in production it should be
  sanitized to a generic message with a correlation ID for internal
  lookup.

### PII and logging
- **IF the code logs an object that may contain PII THEN** verify the
  log call serializes only allowed fields. Reject `log.info(user)`
  in favor of `log.info({ user_id: user.id, action: "x" })`.
- **IF the diff introduces a new field that touches PII (email,
  phone, address, government ID, biometric) THEN** verify it is
  excluded from the default log serializer and from error reporters
  (Sentry/Rollbar/etc.).
- **IF a log entry could be triggered millions of times per day with
  user-controlled content THEN** evaluate as a log-injection vector
  and require sanitization (strip newlines, cap length).

### Access-control boundaries and input validation
- **IF the diff introduces a new HTTP endpoint THEN** verify:
  - rate limiting is configured (or documented as out of scope)
  - input validation runs at the boundary (zod, pydantic, etc.)
  - CORS is intentional (not `*` unless the endpoint is public read)
  - CSRF protection is in place for state-changing methods
- **IF the diff introduces SSRF surface (server-side HTTP requests to
  user-controlled URLs) THEN** require an allowlist of acceptable
  hosts AND blocking of internal address ranges
  (`169.254.0.0/16`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`, `::1`, `fc00::/7`).
- **IF file upload is introduced THEN** verify: content-type checked
  by sniffing not by filename extension, size limit enforced, files
  stored outside the web root, served via a separate domain or with
  `Content-Disposition: attachment`.

## Anti-Patterns

- **Defense by obscurity.** Reliance on hidden URLs, randomized IDs
  without authorization, or "they wouldn't think to try that." The
  security review's first job is to assume they will.
- **Authentication-without-authorization.** Checking that the user
  is logged in and skipping the check that they're allowed.
- **Negative-list input filtering.** "Strip these dangerous
  characters." Always incomplete.
- **In-house cryptography.** Designing a token format, a signing
  scheme, or a password hash. Use vetted libraries.
- **`eval`, `Function(string)`, `os.system(string_with_input)`,
  `child_process.exec(string_with_input)`, `marshal.loads(network_data)`,
  `pickle.loads(network_data)`.** Each is an instant code execution
  if attacker controls the input.
- **Disabling TLS verification** (`rejectUnauthorized: false`,
  `verify=False`, `--no-check-certificate`) in production code.
- **Sensitive data in URL parameters.** Logged everywhere, exposed
  in referer headers.

## Review Checklist

- [ ] **Authentication:** middleware runs before user logic; passwords
      hashed with argon2id/bcrypt/scrypt; session tokens ≥128 bits +
      server-revocable; MFA on sensitive ops.
- [ ] **Authorization:** owner-scoped queries include owner check;
      role checks on authoritative path; admin endpoints have extra
      auth; no IDOR on user-controlled IDs.
- [ ] **Injection:** SQL parameterized; shell calls via argv;
      auto-escaping active on HTML; ReDoS-safe regex; LDAP/XPath/
      NoSQL parameterized.
- [ ] **Secrets:** no in-code secrets; `.env*` in `.gitignore`; no
      creds in URLs; error messages sanitized in production.
- [ ] **PII / logging:** allowed-field serialization for user
      objects; PII excluded from default log/error serializers; log
      lines sanitized when content is user-controlled.
- [ ] **Boundaries:** new endpoints have rate-limit, input validation,
      intentional CORS, CSRF for state-changing methods; SSRF surface
      has host allowlist + internal-range block; file uploads sniffed,
      size-limited, served safely.
- [ ] **Components / dependencies:** new dependencies justified;
      `npm audit` / `pip-audit` / equivalent has no high severity;
      pinned to specific versions.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Treat every diff as a review surface. Read changes file-by-file
   asking: "what trust boundary does this code touch?"
2. Surface findings as severity-labeled comments:
   `[critical] / [high] / [medium] / [low] / [info]`. Critical and
   high block merge.
3. Cite the specific rule (e.g., "Spec §3.1 Authorization: owner-scoped
   queries") in each finding so the author can trace the reasoning.
4. Suggest the corrected code, not just the issue. Concrete fix code
   is more useful than "consider parameterizing this."
5. For any finding the agent is < 90% confident on, flag as
   `[needs-human-review]` rather than `[critical]`. False positives
   train reviewers to ignore the bot.
6. End each review with a single one-line summary: "X critical, Y
   high, Z medium" — block merge or approve accordingly.

## Expected Output Format

```
[severity] file:line — short title
What:  one-line explanation of the issue
Why:   which rule it violates + brief threat model
Fix:   suggested code or pattern, inline
```

End with: `SUMMARY: <N> critical, <M> high, <P> medium, <Q> low,
<R> info. Status: [BLOCK | APPROVE-WITH-COMMENT | APPROVE].`

## References

- OWASP Top 10 (current edition): https://owasp.org/Top10/
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/
- OWASP ASVS (Application Security Verification Standard)
- NIST SP 800-53 (Security and Privacy Controls)
- Google SRE Workbook chapter on production security review
- The Tangled Web (Michal Zalewski) for web-specific failure modes

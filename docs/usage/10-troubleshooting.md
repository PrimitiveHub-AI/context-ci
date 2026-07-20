# Troubleshooting

> [← back to index](./README.md) · prev: [Recipes](./08-recipes.md)

Every error you're likely to see + the fix.

---

## Table of contents

- [Install issues](#install-issues)
- [`phub` won't run](#phub-wont-run)
- [Scan + policy issues](#scan--policy-issues)
- [Lock issues](#lock-issues)
- [MCP server issues](#mcp-server-issues)
- [GitHub Action issues](#github-action-issues)
- [Verify library issues](#verify-library-issues)
- [Where to file a bug](#where-to-file-a-bug)

---

## Install issues

### `Cannot find module .../packages/phub/bin/phub.js`

You aliased `phub` to a path that doesn't exist — usually because you
switched branches or are on a branch that doesn't have the package
yet.

**Fix:** check the branch and rebuild.

```bash
git branch --show-current
ls /srv/primitivehub/app/packages/phub/bin/phub.js 2>&1
```

If the bin is missing, switch to a branch that has it (e.g. `main`
after Gate G-C merges) or use the `git worktree` pattern from
[Getting started § C](./01-getting-started.md#c-git-worktree-parallel-checkout).

### `node: command not found` or Node < 20

The verify library uses Web Crypto (`subtle.digest`); Node 18 and
older are missing parts of the API.

**Fix:** install Node ≥ 20 via your package manager or
[nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 20 && nvm use 20
node --version    # → v20.x.x
```

### `pnpm: command not found`

Install pnpm 9+:

```bash
npm install -g pnpm@9
# or via corepack (Node 20+):
corepack enable pnpm
```

### `Error: ERR_REQUIRE_ESM`

You imported the verify library from CommonJS. It's ESM-only.

**Fix:** use dynamic import:

```js
const { verifyBundle } = await import("@primitivehub/verify")
```

…or convert your file to ESM (`type: "module"` in `package.json`).

---

## `phub` won't run

### `Error: pnpm install --frozen-lockfile failed`

Lockfile drift between your `pnpm-lock.yaml` and `package.json`.
This is usually caused by editing dependencies without running
`pnpm install`.

**Fix:**

```bash
pnpm install   # without --frozen-lockfile to regenerate the lock
```

…then commit the updated `pnpm-lock.yaml`.

### `phub --help` works but `phub scan ...` doesn't find the file

Path resolution problem. `phub scan` resolves the file argument
relative to the cwd — if your alias was set in `~/.bashrc` but you
moved directories, the relative path is wrong.

**Fix:** use absolute paths in the scan target, or `cd` to the
project root before scanning.

### `phub scan AGENTS.md` exits 0 but you expected findings

Two possibilities:

1. **A policy file is auto-discovered and permitting findings.**
   Check the source:
   ```bash
   phub scan AGENTS.md --json | jq '.policySource, .policyAllowed | length'
   ```
   If `policySource` is a file path (not `<implicit-default>`), the
   policy permitted some findings. The reasons are in
   `policyAllowed[*].reason`.

2. **Your content doesn't match any v0.1 detector.** Only T1
   (prompt injection), T2 (Unicode steganography), and T5
   (unsafe-shell-install) are implemented. T3/T4/T6..T10 are
   planned.

---

## Scan + policy issues

### `phub scan: policy error in <path>: policy fails schema validation`

Your `policy.yaml` has structural issues. The error message lists
specific problems:

```text
phub scan: policy error in .primitivehub/policy.yaml: policy fails schema validation:
  - allow[0].reason: missing required field 'reason'
  - allow[0].files: expected at least 1 items, got 0
```

**Fix:** address each line. `reason:`, `files:`, and `rules:` are
all required on every allow entry; `files:` and `rules:` must have
≥1 element.

### `policy fails schema validation: - <root>: field 'extends' is reserved in v0.1`

You used a reserved field. v0.1 reserves `extends`, `actors`,
`metadata`, `notify`. These have intended v0.2 semantics; don't
squat them today.

**Fix:** remove the field. If you actually need the functionality,
file an issue.

### `--policy` flag and `.primitivehub/policy.yaml` both exist — which wins?

`--policy <path>` always wins. The `.primitivehub/policy.yaml`
auto-discovery only fires when `--policy` is absent.

### `--strict` in the CLI and `strict: false` in the policy — which wins?

CLI `--strict` (true) overrides `policy.strict: false`. CLI absent
defers to policy.strict. If the policy is `strict: true` and you
don't pass `--strict`, strict mode is on.

### My `--allow-fail=CCI-005` permits findings I didn't expect

`--allow-fail` synthesizes a policy entry that permits the specified
ID on `**/*` (every file). Per [ADR-0030](../decisions/0030-fp-resolution-and-av-vendor-parallel.md)
that's a transient override, not a committed allow. For per-file
allows, use a `policy.yaml` file with a narrow `files:` glob.

### "But the FP-NNN ledger format feels overkill"

Per [ADR-0030 § "Five concrete practices"](../decisions/0030-fp-resolution-and-av-vendor-parallel.md):
the ledger discipline is load-bearing. Tools that don't track
suppressions end up with [allowlist rot](https://docs.snyk.io/scan-with-snyk/snyk-code/manage-snyk-code-results/ignore-issues#allowlist-rot)
(every team has seen this). The 5-minute cost of writing the entry
is repaid the first time you ask "why is this rule suppressed?"
three months later.

---

## Lock issues

### `phub audit: lock file not found at .primitivehub/phub.lock`

You ran `--check-lock` but there's no lock yet.

**Fix:** seal the initial lock:

```bash
phub audit --update-lock
git add .primitivehub/phub.lock && git commit -m "chore: initial lock"
```

### `phub audit --check-lock` exits 2 with `top10_version mismatch`

The committed lock pins a Top 10 version that's different from your
phub binary's runtime version. This is by design: when the spec
ratchets, stale locks need explicit re-seal.

**Fix:** re-seal the lock against the new version:

```bash
phub audit --update-lock
git add .primitivehub/phub.lock
git commit -m "chore: re-seal lock for Top 10 v0.X"
```

(Replace `0.X` with the new version printed in the error.)

### Lock shows drift but I didn't change anything

Three sneaky causes:

1. **Line endings.** A CRLF/LF difference produces a different
   digest. Check `.gitattributes`; consider `git config
   core.autocrlf false` for files in `.primitivehub/`.
2. **Trailing whitespace edits.** Even a trailing space changes the
   digest. Editor "trim trailing whitespace on save" can help.
3. **A renamed file with an unchanged content** appears as
   `removed + added` (not `modified`) because the lock keys on
   path, not content hash.

### `--lock-only` writes to disk but I want stdout

Combine `--lock-only` with `--json`:

```bash
phub audit --lock-only --json > my-snapshot.json
```

Useful when the CI runner can't commit back to the repo.

---

## MCP server issues

### `primitivehub-mcp` exits immediately with no output

The server speaks stdio JSON-RPC. Without input, it has nothing to
do.

**Fix:** pipe a JSON-RPC request:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | primitivehub-mcp
```

### Claude Code shows no `primitivehub` server in `claude mcp list`

Three things to check:

1. Is the `command` path correct?
   ```bash
   ls -la $(jq -r '.mcpServers.primitivehub.args[0]' ~/.claude.json)
   ```
2. Does the binary actually run?
   ```bash
   $(jq -r '.mcpServers.primitivehub.command' ~/.claude.json) \
     $(jq -r '.mcpServers.primitivehub.args[0]' ~/.claude.json) <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```
3. Restart Claude Code — mcp-server registration is read at startup.

### `Error: ENOENT: no such file or directory, open '.../primitivehub-mcp/dist/server.js'`

You didn't build the MCP server. Run `pnpm build` inside
`packages/mcp-server/`.

### A tool call returns `isError: true` with `error: "unknown tool"`

You called a tool name that the server doesn't recognize. v0.1
exposes only four tools: `verify_bundle`, `scan_text`,
`audit_workspace`, `check_lock`.

**Fix:** check the spelling. Tool names are case-sensitive.

---

## GitHub Action issues

### `permission denied: pulling github/codeql-action/upload-sarif`

Your workflow lacks `security-events: write`. Without it the SARIF
upload step fails.

**Fix:** add to the workflow:

```yaml
permissions:
  contents: read
  security-events: write
```

### SARIF lands in Code Scanning but with `phub-context-ci` category empty

Two common causes:

1. `phub scan` didn't actually find anything — clean repo, empty
   SARIF, no Code Scanning rows. (This is correct.)
2. The SARIF file you uploaded is malformed. Run
   `cat phub-results.sarif | jq .` to confirm it parses; check
   `runs[0].results` length.

### "Cannot specify both `sarif_file` and `sarif_files`" from codeql-action

The composite action uses `sarif_file:` (singular) pointing at a
directory; codeql-action will discover all `.sarif` files in it.
Don't pass `sarif_files:` (plural) — that's for a different
invocation pattern.

### Action gives `pnpm: command not found`

The composite action installs phub via `npm`, not pnpm. If your
project's `package.json` requires pnpm, you may need to add a
manual `pnpm/action-setup@v4` step before the phub-scan step (only
matters for `phub-source: 'local'` workflows that build from
source).

---

## Verify library issues

### `verifyBundle` returns `valid: false` with `DIGEST_MISMATCH` on bundles you trust

The content was modified between signing and now. Check:

```bash
node -e "
const { readFileSync } = require('node:fs')
const crypto = require('node:crypto')
const bundle = JSON.parse(readFileSync(process.argv[1], 'utf8'))
const expected = bundle.subject.contentDigest
const actual = 'sha256:' + crypto.createHash('sha256').update(Buffer.from(bundle.content.bytesB64, 'base64')).digest('hex')
console.log({expected, actual, match: expected === actual})
" /path/to/bundle.json
```

If `match: false`, the bundle's content was tampered with after
signing. This is the detector working correctly.

### `*_DEFERRED` failures with `level: "full"`

Verify v0.1 stubs steps 3-6 (signature, cert, Rekor). This is
documented. v0.2 will unstub them.

**Fix:** for v0.1, use `level: "structural"` (just digest) or
`level: "policy"` (digest + Context CI policy). The cryptographic
trust chain is enforced server-side; the library covers it in v0.2.

### Browser bundle is over 50KB

Check that you imported only the public surface:

```ts
// ✓ good — tree-shakes:
import { verifyBundle } from "@primitivehub/verify"

// ✗ bad — pulls everything (forces all paths in the source):
import * as verify from "@primitivehub/verify"
```

Verified production builds are 18.7KB JS unminified; tree-shaking
should keep callers well under the budget.

---

## Where to file a bug

Public issues: <https://github.com/DevXYZx/primitivehub/issues>

Pre-launch posture: the repo is private until the paper publishes.
Internal contributors file in the same tracker; reach out via the
project's normal channels.

Include:

- The exact command you ran (or the JSON-RPC request).
- The full output (stdout + stderr; trim only secrets).
- `phub --version`, `node --version`, `pnpm --version`.
- The branch/commit you're on (`git rev-parse HEAD`).
- For policy issues: the `.primitivehub/policy.yaml` content.
- For lock issues: the diff of `.primitivehub/phub.lock` before/after.

---

## See also

- [Recipes](./08-recipes.md) — end-to-end workflows
- [phub CLI](./02-phub-cli.md) — the reference for every flag mentioned above
- [`docs/bugs.md`](../bugs.md) — known issues + WAI cases + resolutions
- [`docs/false-positive-resolution.md`](../false-positive-resolution.md) — when scans flag content that isn't an attack

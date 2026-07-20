# Getting Started

> [← back to index](./README.md) · next: [phub CLI →](./02-phub-cli.md)

This page makes the `phub` binary work on your machine — pre-launch
from the monorepo today, post-launch via npm.

## Requirements

- **Node ≥ 20.** Web Crypto (`subtle.digest`) is required by the
  verify library; Node 18 is missing parts of the API.
- **pnpm ≥ 9** (or npm ≥ 10). The monorepo uses pnpm; instructions
  here use `pnpm` but `npm install + npm run build` works
  identically.
- **A POSIX shell** for the examples below (bash, zsh, dash).
- **Git** (only needed for the monorepo build path).

Optional but recommended:

- `jq` — every JSON output example pipes through it.
- `python3` — used in a few examples as a JSON pretty-printer
  alternative to `jq`.

## Three install paths

| Path | When to use | Sections below |
|---|---|---|
| **Post-launch (npm)** | The packages are on npm. One-liner. | [§ A](#a-post-launch-npm) |
| **Monorepo build** | Pre-launch, or you want to hack on the source. | [§ B](#b-monorepo-build) |
| **`git worktree`** | You're working on a different branch and want to test without switching. | [§ C](#c-git-worktree-parallel-checkout) |

---

## A. Post-launch (npm)

```bash
# One-off invocation:
npx @primitivehub/phub --help

# Or installed locally:
pnpm add -D @primitivehub/phub
phub --help                    # bin name remains `phub` (unscoped)

# Or installed globally:
pnpm add -g @primitivehub/phub
phub --help
```

The unscoped binary name `phub` is preserved across all install
modes; `npx @primitivehub/phub` is only longer at first-call time.
Once installed, `phub <command>` works regardless of how it was
installed.

For Trust Bundle verification or MCP server integration:

```bash
pnpm add @primitivehub/verify        # programmatic verification library
pnpm add @primitivehub/mcp-server    # MCP server binary primitivehub-mcp
```

See sections [§ phub CLI](./02-phub-cli.md) onwards.

---

## B. Monorepo build

Use this path if:

- You're inside the monorepo working on the source.
- The packages haven't been published yet (pre-launch, per
  [ADR-0022](../decisions/0022-publishing-deferred-to-launch.md)).

```bash
cd /srv/primitivehub/app

# Build the dependency stack in order.
# verify is a file: dep of phub + mcp-server; build it first.
cd packages/verify && pnpm install && pnpm build && cd -

# phub depends on verify's built dist/ via file:
cd packages/phub && pnpm install && pnpm build && cd -

# mcp-server depends on BOTH verify + phub via file:
cd packages/mcp-server && pnpm install && pnpm build && cd -
```

Alias the binaries for your shell session:

```bash
alias phub="node /srv/primitivehub/app/packages/phub/bin/phub.js"
alias primitivehub-mcp="node /srv/primitivehub/app/packages/mcp-server/bin/primitivehub-mcp.js"

# Smoke test:
phub --help | head -10
primitivehub-mcp <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
# → 4
```

The aliases only live for the current shell. Persist them by adding
to `~/.bashrc` / `~/.zshrc`.

### When to rebuild

The dist/ output is checked into `.gitignore` — rebuild after every
`git pull` that touches:

- `packages/verify/src/`
- `packages/phub/src/`
- `packages/mcp-server/src/`

A one-liner that rebuilds everything:

```bash
( cd /srv/primitivehub/app/packages/verify     && pnpm build ) && \
( cd /srv/primitivehub/app/packages/phub       && pnpm build ) && \
( cd /srv/primitivehub/app/packages/mcp-server && pnpm build )
```

---

## C. `git worktree` (parallel checkout)

Use this when you're on one branch and want to test a binary from
another branch without `git switch`-ing (the worktree pattern leaves
your working directory untouched):

```bash
# Create a parallel checkout of the target branch in /tmp/phub-test
git worktree add /tmp/phub-test main

# Build inside the worktree:
cd /tmp/phub-test/packages/verify     && pnpm install && pnpm build && cd -
cd /tmp/phub-test/packages/phub       && pnpm install && pnpm build && cd -
cd /tmp/phub-test/packages/mcp-server && pnpm install && pnpm build && cd -

# Alias against the worktree:
alias phub="node /tmp/phub-test/packages/phub/bin/phub.js"
alias primitivehub-mcp="node /tmp/phub-test/packages/mcp-server/bin/primitivehub-mcp.js"

# When done:
git worktree remove /tmp/phub-test
```

Your original working tree is untouched. The worktree shares git
history with the main repo, so disk usage is minimal (only the
checked-out source).

---

## Verifying the install

Once aliased, these four commands should all succeed:

```bash
# 1. phub speaks help:
phub --help | head -5
# Expected first line: "phub 0.1.0 — PrimitiveHub CLI"

# 2. phub scans a clean string:
phub scan <(echo "# clean primitive") 2>&1 | tail -3
# Expected last line: "Result: 3/3 detectors passed."

# 3. verify library exists (only if you'll use it programmatically):
node -e "import('@primitivehub/verify').then(m => console.log(typeof m.verifyBundle))"
# Post-launch: "function"
# Pre-launch + monorepo: needs the dist/ built first (§B above)

# 4. MCP server lists tools:
primitivehub-mcp <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools[] | .name'
# Expected: 4 lines — audit_workspace, check_lock, scan_text, verify_bundle
```

If any of these fail, see [Troubleshooting § "Install issues"](./09-troubleshooting.md#install-issues).

## Next

- Now that the binary works, [the CLI reference](./02-phub-cli.md) walks
  through every subcommand and flag.
- Or jump to [Recipes](./08-recipes.md) for end-to-end workflows.

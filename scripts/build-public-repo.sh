#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# build-public-repo.sh — assemble the public `primitivehub/context-ci`
# repo tree from this private monorepo. Reproducible: re-run as packages
# evolve. Touches ONLY the output dir; never mutates monorepo sources.
#
# Decision: ADR-0045 (product-first launch, single public distribution repo).
# Structure: pnpm workspace. Internal deps use `workspace:^`; `pnpm publish`
# rewrites them to the real version at publish time, so publish ORDER does
# not matter and there is no stale-lockfile footgun.
#
# What it does NOT do (HUMAN-ONLY, ADR-0045 §4):
#   - create / push the public GitHub repo
#   - claim the npm org or publish anything
#   - flip DNS / lift noindex
# This script only stages a local tree. Pushing + publishing is yours.
#
# Usage:  scripts/build-public-repo.sh [OUT_DIR]
#         OUT_DIR defaults to ./dist-public/context-ci
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$REPO_ROOT/dist-public/context-ci}"
TEMPLATES="$REPO_ROOT/scripts/public-repo"

OLD_REPO="DevXYZx/primitivehub"
# Public GitHub org is PrimitiveHub-AI (https://github.com/orgs/PrimitiveHub-AI);
# repo name is context-ci (ADR-0045 §2). This variable is the ONE source of
# truth for the slug: step 2b rewrites every copied reference to it, and the
# leak-check (step 6) fails the build if any other slug — the private monorepo
# or a stale public one — survives anywhere in the tree. NOTE: the npm scope
# stays @primitivehub (a separate namespace from the GitHub org); package names
# are unchanged. If you named the repo something other than context-ci, edit
# only this line.
NEW_REPO="PrimitiveHub-AI/context-ci"

echo "→ assembling $NEW_REPO into: $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/packages" "$OUT/actions" "$OUT/examples"

# 1. Copy the four downloadable artifacts + examples, excluding build junk
#    and per-package lockfiles (the workspace uses a single root lock).
copy() {
  rsync -a --exclude node_modules --exclude dist --exclude '.turbo' \
        --exclude 'coverage' --exclude 'pnpm-lock.yaml' \
        "$REPO_ROOT/$1" "$OUT/$(dirname "$2")/"
}
copy "packages/verify"       "packages/verify"
copy "packages/phub"         "packages/phub"
copy "packages/mcp-server"   "packages/mcp-server"
copy "actions/phub-scan"     "actions/phub-scan"
# examples/ is NOT a workspace member; keep its own lockfile so it stays a
# realistic standalone consumer (ADR-0045 §4 step 8).
rsync -a --exclude node_modules --exclude dist "$REPO_ROOT/examples/verify-embed" "$OUT/examples/"

# 1b. Vendor the PUBLIC conformance suites the package test-suites read. These
#     suites are the executable spec (safe to publish); the sensitive
#     adversarial corpus lives in bench/ and stays private (never copied here).
#     Recreating the canonical docs/*/conformance paths + the
#     .primitivehub/phub.lock repo-root sentinel lets the tests' walk-up fixture
#     finders resolve with ZERO test-code changes. Step 6's leak-check permits
#     ONLY these paths under docs/ and .primitivehub/ — nothing else.
echo "→ vendoring public conformance suites for the package test-suites"
for suite in trust-contract/conformance context-ci-top-10/conformance \
             context-policy/conformance cbom/conformance; do
  mkdir -p "$OUT/docs/$(dirname "$suite")"
  rsync -a "$REPO_ROOT/docs/$suite" "$OUT/docs/$(dirname "$suite")/"
done
cp "$REPO_ROOT/docs/cbom/schema.json" "$OUT/docs/cbom/schema.json"
# The phub-install / mcp-server finders only test EXISTENCE of this file to
# locate the repo root — they never read the monorepo's lock content. Ship a
# minimal placeholder, NOT the real lock (which carries install state).
mkdir -p "$OUT/.primitivehub"
cat > "$OUT/.primitivehub/phub.lock" <<'LOCK'
{
  "$schema": "https://primitivehub.ai/phub-lock/v0.1.json",
  "artifacts": [],
  "generator": "phub@0.1.0",
  "root": ".",
  "top10_version": "0.1",
  "version": "0.1"
}
LOCK

# 2. Rewrite manifests in the COPY only: internal file: deps → workspace:^,
#    and repo/bugs URLs → the public repo. Pure JSON edits via node.
for pkg in verify phub mcp-server; do
  node - "$OUT/packages/$pkg/package.json" "$OLD_REPO" "$NEW_REPO" <<'NODE'
const [file, oldRepo, newRepo] = process.argv.slice(2);
const fs = require("fs");
const p = JSON.parse(fs.readFileSync(file, "utf8"));
for (const k of ["dependencies", "devDependencies"]) {
  if (!p[k]) continue;
  for (const [dep, range] of Object.entries(p[k])) {
    if (dep.startsWith("@primitivehub/") && String(range).startsWith("file:")) {
      p[k][dep] = "workspace:^";   // pnpm publish → ^<version> automatically
    }
  }
}
const sub = (s) => typeof s === "string" ? s.split(oldRepo).join(newRepo) : s;
if (p.repository?.url) p.repository.url = sub(p.repository.url);
if (p.bugs?.url) p.bugs.url = sub(p.bugs.url);
fs.writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
NODE
done

# 2b. Single source of truth for the GitHub slug. Step 2 only rewrote the three
#     package.json repository/bugs URLs; but the PRIVATE monorepo slug also
#     lives in packages/*/CHANGELOG.md (shipped — CHANGELOG.md is in every
#     package's `files`) and in packages/phub/src/cli.ts's help URL (compiled
#     into dist/ → shipped to every npm user). Left unrewritten those LEAK the
#     private repo name. Rewrite EVERY occurrence of $OLD_REPO and any stale
#     public slug across the COPIED tree to $NEW_REPO. The leak-check (step 6)
#     then proves none survived.
echo "→ normalizing GitHub slug across copied tree → $NEW_REPO"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  node - "$f" "$OLD_REPO" "$NEW_REPO" <<'NODE'
const [file, oldRepo, newRepo] = process.argv.slice(2);
const fs = require("fs");
const before = fs.readFileSync(file, "utf8");
const after = before.split(oldRepo).join(newRepo)
                    .split("primitivehub/context-ci").join(newRepo);
if (after !== before) fs.writeFileSync(file, after);
NODE
done < <(grep -rIl -e "$OLD_REPO" -e 'primitivehub/context-ci' "$OUT" 2>/dev/null || true)

# 3. Root scaffolding: workspace files, download-surface README, public
#    SECURITY (links resolve on the public web, not monorepo docs/), MIT
#    LICENSE, CONTRIBUTING, .gitignore.
cp "$TEMPLATES/pnpm-workspace.yaml" "$OUT/pnpm-workspace.yaml"
cp "$TEMPLATES/package.json"        "$OUT/package.json"
cp "$TEMPLATES/README.md"           "$OUT/README.md"
cp "$TEMPLATES/CONTRIBUTING.md"     "$OUT/CONTRIBUTING.md"
cp "$TEMPLATES/SECURITY.md"         "$OUT/SECURITY.md"
cp "$REPO_ROOT/packages/verify/LICENSE" "$OUT/LICENSE"
printf 'node_modules/\ndist/\ncoverage/\n*.tgz\n' > "$OUT/.gitignore"

# 4. Public CI + (gated) publish workflows. These are workspace-model
#    rewrites authored for the public repo — the monorepo originals encode
#    the old per-package file:-dep "build verify first" dance that the
#    workspace deletes, and trigger on apps/api paths that don't exist here.
#    Copied verbatim from templates (already carry the public repo slug).
mkdir -p "$OUT/.github/workflows"
cp "$TEMPLATES/workflows/"*.yml "$OUT/.github/workflows/"

# 5. Generate the single root lockfile (no install of node_modules). Needs
#    network for the npm registry; if offline, the publish-prep step must
#    run it. Non-fatal here so the tree still stages.
echo "→ generating root pnpm-lock.yaml (--lockfile-only)…"
if (cd "$OUT" && pnpm install --lockfile-only >/tmp/phub-pnpm-lock.log 2>&1); then
  echo "✓ root pnpm-lock.yaml generated"
else
  echo "⚠ could not generate lockfile here (likely offline). Run before publish:"
  echo "    (cd $OUT && pnpm install --lockfile-only)"
fi

# 6. Leak-check — refuse to emit a tree that carries monorepo-private surface
#    or points anywhere but $NEW_REPO. The copy list (step 1) is an allowlist,
#    but this fails LOUDLY if a future edit widens it or a reference regresses.
#    This is the "how do I KNOW the website / private repo never ships"
#    guarantee — enforced by the build, not trusted.
echo "→ leak-check: verifying only the public scanner surface is staged…"
fail=0

# (a) No monorepo-private surface. apps/bench/paper/.claude + strategy docs are
#     always forbidden. docs/ and .primitivehub/ are permitted ONLY for the
#     vendored public conformance suites (docs/*/conformance/* + the cbom
#     schema) and the phub.lock repo-root sentinel; anything else under them is
#     a leak.
# Vendored conformance suites legitimately contain sample files named
# CLAUDE.md / AGENTS.md etc. (they are scan-target fixtures), so the name-based
# strategy-doc checks must NOT apply inside the allowed conformance paths.
priv="$(cd "$OUT" && find . -type f \
       ! -path './docs/*/conformance/*' ! -path './docs/cbom/schema.json' \
       ! -path './.primitivehub/phub.lock' \
    \( -path './apps/*' -o -path './bench/*' -o -path './paper/*' -o -path './.claude/*' \
       -o -name 'CLAUDE.md' -o -name '*.tex' -o -name '*.bib' \) 2>/dev/null || true)"
docsleak="$(cd "$OUT" && [ -d docs ] && find docs -type f \
       ! -path 'docs/*/conformance/*' ! -path 'docs/cbom/schema.json' 2>/dev/null || true)"
phleak="$(cd "$OUT" && [ -d .primitivehub ] && find .primitivehub -type f \
       ! -path '.primitivehub/phub.lock' 2>/dev/null || true)"
if [ -n "$priv$docsleak$phleak" ]; then
  echo "✗ LEAK: monorepo-private surface found in public tree:"
  printf '     %s\n' $priv $docsleak $phleak; fail=1
fi

# (b) Top level must be EXACTLY the known public surface — nothing extra.
extra="$(cd "$OUT" && find . -maxdepth 1 -mindepth 1 \
       ! -name packages ! -name actions ! -name examples ! -name .github \
       ! -name docs ! -name .primitivehub \
       ! -name .gitignore ! -name pnpm-workspace.yaml ! -name package.json \
       ! -name pnpm-lock.yaml ! -name README.md ! -name CONTRIBUTING.md \
       ! -name SECURITY.md  ! -name LICENSE 2>/dev/null || true)"
if [ -n "$extra" ]; then
  echo "✗ LEAK: unexpected top-level entries (not part of the public surface):"
  printf '     %s\n' $extra; fail=1
fi

# (c) No file may reference the PRIVATE monorepo or a stale/wrong repo slug —
#     the only GitHub slug allowed anywhere in the tree is $NEW_REPO.
badref="$(cd "$OUT" && grep -rIl -e "$OLD_REPO" -e 'primitivehub/context-ci' . 2>/dev/null || true)"
if [ -n "$badref" ]; then
  echo "✗ LEAK: files still point at the private monorepo or a stale repo slug"
  echo "        (only $NEW_REPO is allowed):"
  printf '     %s\n' $badref; fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "✗ leak-check FAILED — refusing to produce a leaky tree."
  echo "  Fix the copy allowlist (step 1) / templates, then re-run."
  exit 1
fi
echo "✓ leak-check passed — only the scanner surface, pointing only at $NEW_REPO"

echo "✓ done. Tree staged at: $OUT"

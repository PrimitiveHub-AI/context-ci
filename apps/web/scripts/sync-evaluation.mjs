#!/usr/bin/env node
/**
 * sync-evaluation.mjs — copy the newest committed baseline into the
 * web app's embedded data file.
 *
 * Why this exists: `apps/web/lib/evaluation.ts` reads measured P/R/F1
 * from `apps/web/lib/evaluation.data.json` (a build-time-embedded
 * snapshot). The authoritative file lives at
 * `bench/baseline/YYYY-MM-DD-ts.json` — outside the web app's Docker
 * build context. This script bridges the two: whenever the
 * scanner-bench gate writes a fresh baseline, run this to refresh
 * the embedded copy.
 *
 * Recommended wiring (post-launch): a CI step that runs this and
 * fails the build if the result is non-empty (i.e. the embedded
 * snapshot was stale at PR time). The FLOOR.md discipline guarantees
 * the baseline only ratchets upward, so a stale embedded snapshot
 * understates the engine — never overstates — and is safe to ship
 * temporarily but should be refreshed each release.
 *
 * Usage:
 *   pnpm --filter primitivehub sync:evaluation       # from monorepo root
 *   node apps/web/scripts/sync-evaluation.mjs        # direct
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, "../../..")
const BASELINE_DIR = path.join(REPO_ROOT, "bench/baseline")
const EMBEDDED = path.resolve(HERE, "../lib/evaluation.data.json")

const TS_NAME_RE = /^(\d{4}-\d{2}-\d{2})-ts\.json$/

function latest() {
  const dated = readdirSync(BASELINE_DIR)
    .filter((e) => TS_NAME_RE.test(e))
    .sort()
  const tip = dated[dated.length - 1]
  if (!tip) throw new Error(`No TS baselines found at ${BASELINE_DIR}`)
  return path.join(BASELINE_DIR, tip)
}

const src = latest()
const next = readFileSync(src, "utf8")
let prev = ""
try {
  prev = readFileSync(EMBEDDED, "utf8")
} catch {
  // first run; fine
}

if (prev === next) {
  console.log(`sync-evaluation: already up-to-date with ${path.basename(src)}`)
  process.exit(0)
}

writeFileSync(EMBEDDED, next)
console.log(
  `sync-evaluation: ${path.basename(src)} -> apps/web/lib/evaluation.data.json`,
)

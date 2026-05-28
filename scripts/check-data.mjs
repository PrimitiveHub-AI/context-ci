// Data integrity checks for PrimitiveHub mock data.
// Run with: pnpm check:data
// Requires Node 22.6+ (uses --experimental-strip-types to import .ts files directly).

import { primitives } from "../lib/data/primitives.ts"
import { bundles } from "../lib/data/bundles.ts"
import { contributors } from "../lib/data/contributors.ts"
import { reviewQueue } from "../lib/data/reviews.ts"
import { pipelineStages } from "../lib/data/pipeline.ts"
import { categories } from "../lib/data/categories.ts"
import { agents } from "../lib/data/agents.ts"

const failures = []
const ok = (label) => console.log(`  \x1b[32m✓\x1b[0m ${label}`)
const fail = (label, detail) => {
  failures.push({ label, detail })
  console.log(`  \x1b[31m✗\x1b[0m ${label}\n      ${detail}`)
}

const SCORE_FIELDS = ["qualityScore", "safetyScore", "contextEfficiency", "agentImpact"]
const DIGEST_RE = /^sha256:[a-f0-9]+\.?\.?\.?$/i
const SEMVER_RE = /^\d+\.\d+\.\d+$/

console.log("\n\x1b[1mPrimitiveHub :: data integrity checks\x1b[0m\n")

// -- primitives --
console.log("primitives")
{
  const slugs = new Set()
  const fileNames = new Set()
  for (const p of primitives) {
    if (slugs.has(p.slug)) fail("unique slugs", `duplicate slug: ${p.slug}`)
    slugs.add(p.slug)
    if (fileNames.has(p.fileName)) fail("unique fileNames", `duplicate fileName: ${p.fileName}`)
    fileNames.add(p.fileName)
    if (!p.fileName.endsWith(".md")) fail("fileName ends with .md", `${p.fileName}`)
    if (!p.fileName.startsWith(p.slug)) fail("fileName starts with slug", `${p.fileName} vs slug ${p.slug}`)
    if (!SEMVER_RE.test(p.version)) fail("semver version", `${p.slug}: "${p.version}"`)
    if (!DIGEST_RE.test(p.contentDigest)) fail("contentDigest format", `${p.slug}: "${p.contentDigest}"`)
    if (p.tokens > p.tokenBudget) fail("tokens within budget", `${p.slug}: ${p.tokens}/${p.tokenBudget}`)
    if (p.tokens <= 0) fail("tokens > 0", `${p.slug}: ${p.tokens}`)
    for (const f of SCORE_FIELDS) {
      const v = p[f]
      if (typeof v !== "number" || v < 0 || v > 100) fail(`${f} in [0,100]`, `${p.slug}: ${v}`)
    }
    if (!categories.includes(p.category)) fail("category in canonical list", `${p.slug}: ${p.category}`)
    for (const a of p.compatibleAgents) {
      if (!agents.includes(a)) fail("compatibleAgent in canonical list", `${p.slug}: ${a}`)
    }
    if (!["low", "medium", "high"].includes(p.riskLevel)) fail("riskLevel enum", `${p.slug}: ${p.riskLevel}`)
    if (!p.useWhen?.length) fail("useWhen non-empty", `${p.slug}`)
    if (!p.doNotUseWhen?.length) fail("doNotUseWhen non-empty", `${p.slug}`)
  }
  ok(`${primitives.length} primitives, all slugs unique`)
  ok(`all primitives semver-valid, digest-shaped, within token budget, scores in [0,100]`)
  ok(`all primitives reference canonical categories + agents`)
}

// -- bundles --
console.log("\nbundles")
{
  const primitiveFileNames = new Set(primitives.map((p) => p.fileName))
  const bundleSlugs = new Set()
  for (const b of bundles) {
    if (bundleSlugs.has(b.slug)) fail("unique bundle slugs", `duplicate: ${b.slug}`)
    bundleSlugs.add(b.slug)
    if (b.totalTokens > b.totalBudget) fail("bundle tokens within budget", `${b.slug}: ${b.totalTokens}/${b.totalBudget}`)
    if (!b.primitives.length) fail("bundle has primitives", `${b.slug}`)
    for (const fn of b.primitives) {
      if (!primitiveFileNames.has(fn)) fail("bundle references real primitive", `${b.slug} -> ${fn} (not found)`)
    }
    for (const a of b.compatibleAgents) {
      if (!agents.includes(a)) fail("bundle agent canonical", `${b.slug}: ${a}`)
    }
    if (b.qualityAverage < 0 || b.qualityAverage > 100) fail("bundle qualityAverage in [0,100]", `${b.slug}: ${b.qualityAverage}`)
  }
  ok(`${bundles.length} bundles, all references resolve to real primitives`)
}

// -- pipeline stages --
console.log("\npipeline")
{
  const validStatus = ["passed", "warning", "failed"]
  for (const s of pipelineStages) {
    if (!validStatus.includes(s.status)) fail("stage.status enum", `${s.name}: ${s.status}`)
    if (s.score < 0 || s.score > 100) fail("stage.score in [0,100]", `${s.name}: ${s.score}`)
  }
  ok(`${pipelineStages.length} stages with valid status + score`)
}

// -- reviews --
console.log("\nreviews")
{
  const validStatus = ["Needs Security Review", "Benchmark Failed", "Human Review Pending", "Approved", "Rejected"]
  for (const r of reviewQueue) {
    if (!validStatus.includes(r.status)) fail("review.status enum", `${r.primitive}: ${r.status}`)
    if (!SEMVER_RE.test(r.version)) fail("review.version semver", `${r.primitive}: ${r.version}`)
  }
  ok(`${reviewQueue.length} review items with valid status + semver`)
}

// -- contributors --
console.log("\ncontributors")
{
  const validRoles = ["Maintainer", "Verified Expert", "Author", "Reviewer", "Security Reviewer"]
  const names = new Set()
  for (const c of contributors) {
    if (names.has(c.name)) fail("unique contributor names", `duplicate: ${c.name}`)
    names.add(c.name)
    if (!validRoles.includes(c.role)) fail("contributor.role enum", `${c.name}: ${c.role}`)
    if (c.reputation < 0 || c.reputation > 100) fail("reputation in [0,100]", `${c.name}: ${c.reputation}`)
  }
  ok(`${contributors.length} contributors with valid roles + reputation`)
}

// -- cross-references --
console.log("\ncross-references")
{
  // every authored primitive's author should appear as a contributor (or at least be plausible)
  const contributorNames = new Set(contributors.map((c) => c.name))
  for (const p of primitives) {
    if (!contributorNames.has(p.author)) {
      fail("primitive author present in contributors", `${p.slug}: author "${p.author}" not in contributors`)
    }
  }
  ok(`every primitive author appears in the contributors list`)

  // every review queue item points at a real or "in-flight" primitive name (not strictly enforced — drafts allowed)
  const primitiveFileNames = new Set(primitives.map((p) => p.fileName))
  let unknownReviewTargets = 0
  for (const r of reviewQueue) {
    if (!primitiveFileNames.has(r.primitive)) unknownReviewTargets++
  }
  if (unknownReviewTargets > 0) {
    ok(`${unknownReviewTargets} review-queue item(s) target draft primitives (not in registry — expected for in-flight submissions)`)
  } else {
    ok(`all review-queue items target known primitives`)
  }
}

console.log()
if (failures.length) {
  console.log(`\x1b[31m\x1b[1m${failures.length} check(s) failed.\x1b[0m`)
  process.exit(1)
}
console.log(`\x1b[32m\x1b[1mAll data integrity checks passed.\x1b[0m`)

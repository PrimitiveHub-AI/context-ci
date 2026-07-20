/**
 * 30-line embedding demo for @primitivehub/verify.
 * Run: pnpm verify <path-to-bundle.json>
 */
import { readFileSync } from "node:fs"
import { verifyBundle } from "@primitivehub/verify"

const path = process.argv[2]
if (!path) {
  console.error("usage: pnpm verify <path-to-bundle.json>")
  process.exit(2)
}

const bundle = JSON.parse(readFileSync(path, "utf8"))
const result = await verifyBundle(bundle, { level: "policy" })

if (!result.valid) {
  console.error(`Trust Bundle rejected (${result.failures.length} failure(s)):`)
  for (const f of result.failures) {
    console.error(`  [${f.code}] ${f.message}${f.path ? ` (at ${f.path})` : ""}`)
  }
  process.exit(1)
}

const { subject, attestation } = bundle
console.log(`Trust Bundle verified: ${subject.slug}@${subject.semver}`)
console.log(`  subject.contentDigest: ${subject.contentDigest}`)
console.log(`  attestation.backend:   ${attestation.backendName}`)

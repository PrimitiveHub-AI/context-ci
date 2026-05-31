# invalid/02-unknown-bundle-version

**Verification step expected to reject:** step 1 (schema validation).

**What's wrong:** `bundleVersion` is `"9.9"`, not the only legal value
for v0.1 conformance: `"0.1"`.

**Expected consumer behavior:** reject with a clear "unknown bundle
version" error. A v0.1 consumer MUST refuse bundles whose version it
doesn't recognize, per Trust Contract v0.1 § 5.1.

**Why this matters:** forward-compatibility discipline. A v0.1
consumer that quietly accepts a v9.9 bundle is silently trusting
semantics it doesn't understand — a worse failure mode than an explicit
refusal.

**Schema validation:** fails (JSON Schema `const: "0.1"` is unmet).
**Semantic validation:** not reached (schema gate fires first).

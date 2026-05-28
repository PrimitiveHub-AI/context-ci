import type { PipelineStage } from "@/lib/types"

export const pipelineStages: PipelineStage[] = [
  { name: "Submit Primitive", status: "passed", score: 100, duration: "0.1s", log: "Primitive secure-code-review.md submitted for validation by SecureAI Contributors", reviewer: "" },
  { name: "Schema Validation", status: "passed", score: 100, duration: "0.3s", log: "[PASS] YAML frontmatter valid. All 12 required fields present. Semver format verified.", reviewer: "" },
  { name: "Structure Linting", status: "passed", score: 98, duration: "0.8s", log: "[PASS] 6/6 required sections detected. 2/3 recommended sections present. Missing: References.", reviewer: "" },
  { name: "Safety Scan", status: "passed", score: 99, duration: "1.2s", log: "[PASS] 0 prompt injection vectors. 0 unsafe instructions. 0 PII leaks. 0 encoded payloads.", reviewer: "" },
  { name: "Copyright / Similarity", status: "passed", score: 95, duration: "2.4s", log: "[PASS] Similarity index: 2.1% (threshold: 15%). No license violations. Original content verified.", reviewer: "" },
  { name: "Token Efficiency", status: "warning", score: 87, duration: "0.5s", log: "[WARN] Token count: 5,100 / 6,000 budget (85%). Above recommended density. Consider splitting.", reviewer: "" },
  { name: "Contradiction Detection", status: "passed", score: 96, duration: "3.1s", log: "[PASS] 0 contradictory instructions across 47 decision rules. Semantic consistency: 96%.", reviewer: "" },
  { name: "Agent Benchmark", status: "passed", score: 91, duration: "12.8s", log: "[PASS] Tested against 5 agents x 3 prompts. Avg improvement: +38% specificity, +42% compliance.", reviewer: "" },
  { name: "Human Review", status: "passed", score: 94, duration: "2d 4h", log: "[PASS] Reviewed by Marcus Webb (Security Reviewer, Rep: 95). 2 minor suggestions incorporated.", reviewer: "Marcus Webb" },
  { name: "Signed Trusted Release", status: "passed", score: 100, duration: "0.2s", log: "[RELEASE] Content digest sha256:c9d1e2f4a7b85c3d signed Ed25519. Published to registry as v1.2.0. Immutable record stored.", reviewer: "" },
]

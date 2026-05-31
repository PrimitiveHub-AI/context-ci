/**
 * SARIF 2.1.0 reporter for phub scan.
 *
 * Emits a single-run SARIF document suitable for upload to GitHub
 * Code Scanning via `github/codeql-action/upload-sarif`. Schema:
 * https://json.schemastore.org/sarif-2.1.0.json
 *
 * Design choices:
 * - The tool.driver.rules catalog ALWAYS lists every detector phub
 *   ships (not just the ones that ran). Consumers see the full
 *   rule catalog even when --detector=<id> filters the run.
 * - INFO + passed=true verdicts emit NO result. Empty findings is a
 *   valid SARIF document; we don't pollute the Code Scanning UI
 *   with "this detector ran and found nothing" noise.
 * - partialFingerprints uses sha256 of (ruleId, detailTag, snippet)
 *   so GitHub can dedupe findings across runs even when a finding
 *   moves by a line or two. Stable across reformat-only changes.
 * - artifactLocation.uri is emitted exactly as the user passed
 *   `<file>` to `phub scan`. Callers wanting repo-relative paths
 *   (e.g. the GitHub Action) MUST invoke phub from $GITHUB_WORKSPACE
 *   with relative paths.
 */

import { createHash } from "node:crypto"

import { DETECTORS } from "../scanners/registry.js"
import { Severity, type Verdict } from "../scanners/types.js"

const SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json"
const SARIF_VERSION = "2.1.0"
const TOOL_VERSION = "0.1.0"
const TOOL_NAME = "phub"
const TOOL_INFORMATION_URI = "https://primitivehub.ai"

interface RuleDescription {
  shortDescription: string
  fullDescription: string
  helpUri: string
}

const RULE_DESCRIPTIONS: Record<string, RuleDescription> = {
  "CCI-001": {
    shortDescription: "Prompt injection pattern in agent context.",
    fullDescription:
      "Patterns that override the agent's system prompt, hijack its role, hide instructions in comments/code-fences, or hint at credential exfiltration. Context CI Top 10 v0.1 — CCI-001. See https://primitivehub.ai/top-10.",
    helpUri: "https://primitivehub.ai/top-10#CCI-001",
  },
  "CCI-002": {
    shortDescription: "Unicode steganography pattern in agent context.",
    fullDescription:
      "Zero-width characters, bidi-control codepoints, tag-range characters, or mixed-script confusables — content invisible or misleading to human reviewers but visible to the agent's tokenizer. Context CI Top 10 v0.1 — CCI-002.",
    helpUri: "https://primitivehub.ai/top-10#CCI-002",
  },
  "CCI-005": {
    shortDescription: "Unsafe shell install (Shai-Hulud) pattern in agent context.",
    fullDescription:
      "Instructions to fetch and execute code from the network without verification (curl | bash, npx arbitrary install, pip from URL/git, natural-language install instructions). Context CI Top 10 v0.1 — CCI-005.",
    helpUri: "https://primitivehub.ai/top-10#CCI-005",
  },
}

type SarifLevel = "error" | "warning" | "note"

function severityToSarifLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case Severity.FAIL:
      return "error"
    case Severity.WARN:
      return "warning"
    case Severity.INFO:
      return "note"
  }
}

function snippetFingerprint(ruleId: string, tag: string, snippet: string): string {
  return createHash("sha256")
    .update(`${ruleId}::${tag}::${snippet}`)
    .digest("hex")
    .slice(0, 16)
}

function ruleNameFromDetector(name: string): string {
  // SARIF rule.name MUST be a single identifier-like token; strip
  // dots and dashes from "t1.prompt_injection" → "t1_prompt_injection".
  return name.replace(/[^a-zA-Z0-9_]/g, "_")
}

/**
 * Build a SARIF 2.1.0 document for a single scanned file.
 *
 * Multi-file callers should emit one SARIF per file into a directory
 * and use github/codeql-action/upload-sarif's directory-merge mode.
 */
export function renderSarif(filename: string, verdicts: readonly Verdict[]): string {
  const rules = DETECTORS.map((d) => {
    const desc = RULE_DESCRIPTIONS[d.cciId]
    return {
      id: d.cciId,
      name: ruleNameFromDetector(d.name),
      shortDescription: { text: desc?.shortDescription ?? d.name },
      fullDescription: { text: desc?.fullDescription ?? d.name },
      helpUri: desc?.helpUri ?? TOOL_INFORMATION_URI,
      defaultConfiguration: { level: "error" as const },
      properties: {
        threatCategory: d.threatCategory,
        cciId: d.cciId,
        detectorVersion: d.detectorVersion,
      },
    }
  })
  const ruleIndexByCciId = new Map(DETECTORS.map((d, i) => [d.cciId, i]))

  const results: object[] = []
  for (const v of verdicts) {
    if (v.passed || v.diffHints.length === 0) continue
    const ruleIndex = ruleIndexByCciId.get(v.cciId) ?? 0
    const level = severityToSarifLevel(v.severity)
    for (const h of v.diffHints) {
      results.push({
        ruleId: v.cciId,
        ruleIndex,
        level,
        message: {
          text: `${v.summary}\n  Match: ${h.snippet}\n  Suggestion: ${h.suggestion}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: filename },
              region: {
                startLine: h.line,
                snippet: { text: h.snippet },
              },
            },
          },
        ],
        partialFingerprints: {
          contextCiDetail: snippetFingerprint(v.cciId, h.detailTag, h.snippet),
        },
        properties: {
          detailTag: h.detailTag,
          threatCategory: DETECTORS[ruleIndex]?.threatCategory ?? "",
        },
      })
    }
  }

  const sarif = {
    $schema: SARIF_SCHEMA,
    version: SARIF_VERSION,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            semanticVersion: TOOL_VERSION,
            informationUri: TOOL_INFORMATION_URI,
            rules,
          },
        },
        results,
      },
    ],
  }

  return JSON.stringify(sarif, null, 2)
}

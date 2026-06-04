/**
 * T6 — Credential exfiltration via instruction.
 *
 * TS port of apps/api/scanners/t6_credential_exfiltration.py. The
 * secret-var and credential-file allowlists, plus every regex
 * shape, mirror the Python source byte-for-byte per ADR-0023
 * lockstep rule.
 *
 * JS regex DOES need the `s` (dotAll) flag where the Python source
 * passes `re.DOTALL`. We add `s` to those regexes explicitly.
 */

import {
  type DetectorContext,
  type DiffHint,
  MAX_HINTS_PER_VERDICT,
  Severity,
  truncateSnippet,
  type Verdict,
  lineForPosition,
} from "./types.js"

const SECRET_VARS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "GCP_SERVICE_ACCOUNT",
  "AZURE_CLIENT_SECRET",
  "NPM_TOKEN",
  "DOCKER_PASSWORD",
  "DATABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VERCEL_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "HUGGINGFACE_TOKEN",
  "SECRET_KEY",
  "JWT_SECRET",
]
const SECRET_VAR_ALT = SECRET_VARS.join("|")

const SECRET_FILES = [
  "\\.env",
  "~/\\.ssh/id_rsa",
  "~/\\.aws/credentials",
  "~/\\.kube/config",
  "~/\\.npmrc",
  "~/\\.pypirc",
  "~/\\.docker/config\\.json",
  "\\.git-credentials",
  "secrets\\.yaml",
  "secrets\\.yml",
]
const SECRET_FILE_ALT = SECRET_FILES.join("|")

const SEND_SECRETS_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\b(?:send|transmit|post|forward|relay|exfiltrate|leak)\\s+(?:the\\s+|your\\s+|all\\s+)?(?:value\\s+of\\s+)?\\$?(?:${SECRET_VAR_ALT})\\s+to\\b`,
      "gims",
    ),
    "send-secrets-to-destination",
  ],
  [
    /\b(?:email|send|mail|forward)\s+(?:all\s+|your\s+|the\s+)?(?:env|environment|secret|secrets|token|tokens|credential|credentials|api[\s_-]?key|api[\s_-]?keys)\s+(?:vars?|variables?|values?)?\s*to\s+\S+@/gims,
    "send-secrets-to-destination",
  ],
  [
    /\b(?:POST|PUT|webhook)\s+(?:all\s+|the\s+|your\s+)?(?:secrets?|tokens?|credentials?|api[\s_-]?keys?)\s+to\s+https?:\/\//gims,
    "send-secrets-to-destination",
  ],
]

const EXFIL_VIA_NETWORK_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\bcurl\\s+(?:-\\w+\\s+)*(?:-d|--data\\b|--data-binary\\b|--data-urlencode\\b)\\s+["']?\\$?(?:${SECRET_VAR_ALT})`,
      "gims",
    ),
    "exfiltrate-via-network",
  ],
  [
    new RegExp(
      `\\bwget\\s+(?:--post-data|--post-file)[=\\s]+["']?\\$?(?:${SECRET_VAR_ALT})`,
      "gims",
    ),
    "exfiltrate-via-network",
  ],
  [
    /\b(?:curl|wget)\s+(?:-\w+\s+)*[^\s]*(?:discord\.com\/api\/webhooks|hooks\.slack\.com|webhook\.site)\b/gims,
    "exfiltrate-via-network",
  ],
]

const HIDE_IN_OUTPUT_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\b(?:include|append|prepend|prefix|suffix|insert)\\s+(?:the\\s+(?:value\\s+of\\s+)?)?\\$?(?:${SECRET_VAR_ALT})\\s+(?:in|to|into|with)\\s+(?:your|the)\\s+(?:response|reply|output|answer)`,
      "gims",
    ),
    "hide-in-output",
  ],
  [
    new RegExp(
      `\\b(?:respond|reply|answer)\\s+with\\s+(?:the\\s+)?(?:contents?\\s+of\\s+)?(?:${SECRET_FILE_ALT})`,
      "gims",
    ),
    "hide-in-output",
  ],
  [
    /\b(?:print|emit|output|echo|show)\s+(?:your\s+|the\s+|all\s+)?(?:secret|secrets|token|tokens|credential|credentials|api[\s_-]?key|api[\s_-]?keys|env\s+vars?|environment\s+variables?)\s+(?:as\s+|in\s+|at\s+|on\s+)?(?:the\s+)?(?:first|every|each)\b/gims,
    "hide-in-output",
  ],
]

const SCAN_AND_SEND_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    new RegExp(
      `\\b(?:read|cat|open|access|extract|exfiltrate|leak)\\s+(?:the\\s+)?(?:contents?\\s+of\\s+)?(?:${SECRET_FILE_ALT}).{0,80}\\b(?:and|then|to)\\b.{0,30}\\b(?:send|email|transmit|post|upload|forward|relay)\\b`,
      "gims",
    ),
    "scan-and-send",
  ],
  [
    /\b(?:grep|find|search)\s+(?:for\s+)?(?:secrets?|tokens?|credentials?|api[\s_-]?keys?|passwords?)\s+(?:in\s+\S+\s+)?(?:and|then|to)\s+(?:send|email|transmit|post|upload)/gims,
    "scan-and-send",
  ],
]

const ALL_PATTERNS = [
  ...SEND_SECRETS_PATTERNS,
  ...EXFIL_VIA_NETWORK_PATTERNS,
  ...HIDE_IN_OUTPUT_PATTERNS,
  ...SCAN_AND_SEND_PATTERNS,
]

function hintForMatch(content: string, match: RegExpExecArray, tag: string): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: `Credential-exfiltration instruction (${tag}). The primitive directs the agent to access and transmit credentials, tokens, or secrets — the agent has legitimate access, so OS-level controls miss this. Remove the instruction or rephrase as a non-actionable description.`,
    detailTag: tag,
  }
}

export class T6CredentialExfiltrationDetector {
  readonly name = "t6.credential_exfiltration"
  readonly threatCategory = "T6"
  readonly cciId = "CCI-006"
  readonly detectorVersion = "0.1.0"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        hints.push(hintForMatch(ctx.content, match, tag))
        if (hints.length >= MAX_HINTS_PER_VERDICT) break outer
        if (match.index === pattern.lastIndex) pattern.lastIndex++
      }
    }

    if (hints.length === 0) {
      return {
        detectorName: this.name,
        threatCategory: this.threatCategory,
        cciId: this.cciId,
        severity: Severity.INFO,
        passed: true,
        summary: "No credential-exfiltration patterns matched.",
        detectorVersion: this.detectorVersion,
        diffHints: [],
      }
    }

    const plural = hints.length === 1 ? "" : "s"
    return {
      detectorName: this.name,
      threatCategory: this.threatCategory,
      cciId: this.cciId,
      severity: Severity.FAIL,
      passed: false,
      summary: `Matched ${hints.length} credential-exfiltration pattern${plural}; instruction directs agent to transmit secrets.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}

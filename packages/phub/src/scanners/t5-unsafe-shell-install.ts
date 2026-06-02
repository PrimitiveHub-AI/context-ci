/**
 * T5 — Unsafe Shell Install (the Shai-Hulud vector).
 *
 * TS port of apps/api/scanners/t5_unsafe_shell_install.py. Pattern
 * set mirrors the Python source byte-for-byte; behavior on shared
 * fixtures must match.
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

const SHELL_PIPE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:curl|wget|fetch)\s+(?:-\w+\s+)*[^\s|]*https?:\/\/[^\s|]+\s*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|csh)\b/gim,
    "shell-pipe-from-network",
  ],
  [
    /\bpython(?:3)?\s+-c\s+["']?\$\(\s*(?:curl|wget)/gim,
    "shell-pipe-from-network",
  ],
  [
    /\b(?:bash|sh|zsh)\s+<\(\s*(?:curl|wget)/gim,
    "shell-pipe-from-network",
  ],
  [
    /\b(?:bash|sh|zsh)\s+-c\s+["']?\$\(\s*(?:curl|wget)/gim,
    "shell-pipe-from-network",
  ],
  [
    /\beval\s+["']?\$\(\s*(?:curl|wget)/gim,
    "shell-pipe-from-network",
  ],
]

const NPX_INSTALL_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bnpx\s+(?:-y\s+|--yes\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-][a-zA-Z0-9@/_.-]+/gim,
    "npx-arbitrary-install",
  ],
]

const PIP_INSTALL_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bpip(?:3)?\s+install\s+(?:--pre\s+|--index-url\s+\S+\s+|--extra-index-url\s+\S+\s+|-e\s+)?(?:https?:\/\/|git\+|svn\+|hg\+|file:\/\/)/gim,
    "pip-arbitrary-install",
  ],
  [
    /\bpython(?:3)?\s+-m\s+pip\s+install\s+(?:--pre\s+|--index-url\s+\S+\s+|--extra-index-url\s+\S+\s+|-e\s+)?(?:https?:\/\/|git\+|svn\+|hg\+|file:\/\/)/gim,
    "pip-arbitrary-install",
  ],
]

const INSTALL_INSTRUCTION_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+(?:this\s+|the\s+following\s+)?(?:command|installer|script)[:\s]*\s*[`]?(?:curl|wget|sudo|npx|pip|sh)\b/gim,
    "install-instruction-to-agent",
  ],
  [
    /\binstall\s+(?:the\s+|this\s+)?(?:\S+\s+)?(?:by\s+running|via|using)\s+[`]?(?:curl|wget|npx|pip|sh|bash)\b/gim,
    "install-instruction-to-agent",
  ],
]

const ALL_PATTERNS = [
  ...SHELL_PIPE_PATTERNS,
  ...NPX_INSTALL_PATTERNS,
  ...PIP_INSTALL_PATTERNS,
  ...INSTALL_INSTRUCTION_PATTERNS,
]

function hintForMatch(
  content: string,
  match: RegExpExecArray,
  tag: string,
): DiffHint {
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: `Remove or rephrase (${tag}); this is the Shai-Hulud vector — remote code fetched and executed without verification.`,
    detailTag: tag,
  }
}

export class T5UnsafeShellInstallDetector {
  readonly name = "t5.unsafe_shell_install"
  readonly threatCategory = "T5"
  readonly cciId = "CCI-005"
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
        summary: "No unsafe-shell-install patterns matched.",
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
      summary: `Matched ${hints.length} unsafe-shell-install pattern${plural}; this is the Shai-Hulud supply-chain vector.`,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}

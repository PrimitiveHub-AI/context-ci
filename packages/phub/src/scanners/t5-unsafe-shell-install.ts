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
import {
  analyzeMarkdownContext,
  fenceContaining,
  isInAnyCodeOrFrontmatter,
  type MarkdownContext,
  type OffsetRange,
} from "./markdown-context.js"
import { isInNegationContext } from "./semantic-context.js"

// v0.2.4 (Round 6 fix 2 — closes FN-009): imperative directive
// keywords that, when appearing within ±3 lines BEFORE a fence,
// mark that fence as "directive-referenced". The detector then
// treats the fence's content as live attack instruction rather
// than documentary example — closing the gap where adversarial
// primitives say "Before responding, run the install hook:
// ```\ncurl ... | sh\n```" and slip past v0.2.x fence-skip.
const DIRECTIVE_RE =
  /\b(?:before\s+(?:you\s+)?(?:respond(?:ing)?|answer(?:ing)?|repl(?:y|ying)|proceed(?:ing)?)|as\s+the\s+(?:first|next)\s+step|first[,\s]+|then[,\s]+|now[,\s]+|on\s+(?:every\s+)?(?:load|read|consume|startup)|at\s+(?:the\s+)?start\s+of\s+(?:every|each)\s+(?:conversation|session|turn))?\s*(?:run|execute|launch|install|bootstrap|initialise|initialize)\s+(?:the\s+|this\s+|that\s+)?(?:install(?:er|ation)?|hook|setup|init|bootstrap|script|command)\b/i

const DIRECTIVE_LOOKBACK_LINES = 3

/** Is `fence` immediately preceded (within DIRECTIVE_LOOKBACK_LINES
 * lines) by an imperative-directive sentence? */
function isDirectiveReferencedFence(content: string, fence: OffsetRange): boolean {
  // Walk back DIRECTIVE_LOOKBACK_LINES lines from the fence start
  // and scan that slice for the directive pattern. The pattern is
  // tolerant of trailing colon / "this command:" / etc.
  let linesSeen = 0
  let cursor = fence[0]
  while (cursor > 0 && linesSeen < DIRECTIVE_LOOKBACK_LINES + 1) {
    const nl = content.lastIndexOf("\n", cursor - 1)
    if (nl < 0) {
      cursor = 0
      break
    }
    cursor = nl
    linesSeen++
  }
  const window = content.slice(Math.max(0, cursor), fence[0])
  return DIRECTIVE_RE.test(window)
}

/** True iff the offset is inside a fence whose preceding prose
 * directs the agent to execute its contents. */
function isInDirectiveReferencedFence(
  content: string,
  offset: number,
  mdCtx: MarkdownContext,
): boolean {
  const fence = fenceContaining(offset, mdCtx)
  if (fence === null) return false
  return isDirectiveReferencedFence(content, fence)
}

// v0.2.7 (Round 13 PR 13.3 — closes FN-024 on S-120 Russian +
// S-123 Chinese multilingual imperative-verb shell-pipe shapes).
// Curated phrasebook of imperative verbs in Russian + Chinese.
// English-language verb set is in the v0.2.6 verb-anchored
// pattern; this constant feeds a parallel multilingual entry.
// Lockstep with apps/api/scanners/t5_unsafe_shell_install.py § v0.2.7.
const MULTILINGUAL_VERB_PHRASEBOOK =
  "выполните|выполнить|запустите|запустить|установите|установить|загрузите" +
  "|执行|运行|安装|启动|请执行|请运行|请安装"

// v0.2.8 (closes FP on S-014 — the only committed CCI-005 FP). The
// verb-anchored install patterns treat a leading imperative verb
// (run/install/launch/…) as "prose directing the agent to execute this
// command." But several of those verbs double as noun modifiers in
// *reference* prose: "the install command (`npx shadcn…`)", "the launch
// script", "the setup guide" — documentation, not an instruction to the
// agent. This zero-width negative lookahead, placed immediately after the
// verb group, suppresses the anchor ONLY when the verb is immediately
// followed by a reference-material noun. Real directives put a
// determiner/object after the verb ("Install the uploader: `curl…`",
// FN-018) so they still match; "run the X command: `curl|bash`" attacks
// anchor on the imperative "run", not the suppressed noun-compound.
// The lookahead itself is inlined into each verb-anchored literal below
// (a template string would have to escape the literal backtick in the
// pattern): `(?!\s+(?:commands?|guides?|instructions?|docs?|documentation
// |references?|examples?|pages?|sections?|flows?|notes?|snippets?)\b)`.
// Lockstep with apps/api/scanners/t5_unsafe_shell_install.py § v0.2.8.

const SHELL_PIPE_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\b(?:curl|wget|fetch)\s+(?:-\w+\s+)*[^\s|]*https?:\/\/[^\s|]+\s*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|csh)\b/gim,
    "shell-pipe-from-network",
  ],
  // v0.2.7 (Round 13 PR 13.3 — closes FN-024): multilingual verb-
  // anchored variant. Same shape as the v0.2.6 English entry but
  // with the non-Latin imperative verbs in the phrasebook.
  [
    new RegExp(
      // Non-Latin Unicode in the gap: replace the ASCII \w class
      // with [^|`\n]{0,180} (any char except pipe / backtick /
      // newline) so Cyrillic + CJK prose between the verb and the
      // backticked command IS matched. Same sentence-boundary
      // discipline as the English pattern — the `[^\n]` excludes
      // multi-line spans.
      `(?:${MULTILINGUAL_VERB_PHRASEBOOK})[^|\`]{0,180}\`\\s*(?:sudo\\s+)?(?:curl|wget|fetch)\\s+(?:-\\w+\\s+)*[^\\s|\`]*https?:\\/\\/[^\\s|\`]+\\s*\\|\\s*(?:sudo\\s+)?(?:sh|bash|zsh|fish|ksh|csh)\\b`,
      "gim",
    ),
    "shell-pipe-from-network",
  ],
  // v0.2.3 (Round 3 — closes test_shell_pipe_family inline-code case).
  // Verb-anchored variant: "Run `curl ... | sh`" / "Then execute
  // `wget ... | bash`". The match.index is at the VERB (outside the
  // backticks), so the inline-code skip in v0.2.1 doesn't apply, but
  // the negation guard still does — "Never run `curl ... | sh`" is
  // still skipped because "Never" precedes the verb within the
  // sentence. AV-strict position: prose that tells the agent to copy-
  // paste a curl|sh from inline code is the Shai-Hulud vector.
  [
    /(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch|install|bootstrap|set\s+up|provision)(?!\s+(?:commands?|guides?|instructions?|docs?|documentation|references?|examples?|pages?|sections?|flows?|notes?|snippets?)\b)[\w\s,:;()\-'’]{0,180}`\s*(?:sudo\s+)?(?:curl|wget|fetch)\s+(?:-\w+\s+)*[^\s|`]*https?:\/\/[^\s|`]+\s*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|fish|ksh|csh)\b/gim,
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
  // v0.2.3 (Round 3 — closes test_npx_install_family inline-code case).
  // Verb-anchored variant: "Then run `npx -y attacker-cli`". Same
  // discipline as the shell-pipe verb-anchored entry. The existing
  // bare-prose npx pattern (which IS inline-code-skip-blocked) still
  // protects benign vendor docs like "`npx shadcn@latest add Button`"
  // shown without a "run/execute/launch" verb before the backtick.
  [
    /(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch|install|bootstrap|set\s+up|provision)(?!\s+(?:commands?|guides?|instructions?|docs?|documentation|references?|examples?|pages?|sections?|flows?|notes?|snippets?)\b)[\w\s,:;()\-'’]{0,180}`\s*npx\s+(?:-y\s+|--yes\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-][a-zA-Z0-9@/_.-]+/gim,
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
  // v0.2.6 (Round 13 PR 13.1 — closes FN-021 on S-116 eslint-config-
  // prettier-style `npm install <pkg>`): add npm / yarn / pnpm / bun
  // to the package-manager keyword set + widen gap between via/using
  // and the backticked command (real-world prose interposes "the
  // canonical command:" between the prep and the backtick).
  [
    /\binstall\s+(?:the\s+|this\s+|it\s+)?(?:\S+\s+)?(?:by\s+running|via|using)[\w\s,:;()\-'’]{0,180}[`]?(?:curl|wget|npx|npm|yarn|pnpm|bun|pip|sh|bash)\b/gim,
    "install-instruction-to-agent",
  ],
]

// v0.2.5 (Round 10 PR 10.1 — closes FN-014 on S-106 brew install +
// Gatekeeper bypass). Homebrew is the macOS Shai-Hulud vector — the
// cask installation pipes through a package manager whose signing
// chain doesn't validate install-time scripts. Pattern shape mirrors
// the npx family. Lockstep with apps/api/scanners/t5_unsafe_shell_install.py § v0.2.5.
const BREW_INSTALL_PATTERNS: Array<readonly [RegExp, string]> = [
  [
    /\bbrew\s+(?:cask\s+)?install\s+(?:--cask\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-]+/gim,
    "brew-install",
  ],
  [
    /(?:^|\s)(?:first[,\s]+|then[,\s]+|now[,\s]+)?(?:run|execute|launch)\s+`\s*brew\s+(?:cask\s+)?install\s+(?:--cask\s+)?(?!--help|--version)[a-zA-Z0-9@/_.-]+/gim,
    "brew-install",
  ],
]

// v0.2.5 — policy-bypass family. When prose instructs the agent to
// disable a platform's signing / policy / sandboxing protection,
// that's prepare-for-untrusted-install regardless of which installer
// follows. Three OSes in scope: macOS Gatekeeper / SIP / quarantine,
// Linux SELinux / AppArmor, Windows execution-policy + Defender.
const POLICY_BYPASS_PATTERNS: Array<readonly [RegExp, string]> = [
  [/\bsudo\s+spctl\s+--(?:master-disable|disable|add)\b/gim, "policy-bypass"],
  [/\bxattr\s+(?:-d\s+|-c\s+|-rd\s+)?com\.apple\.quarantine\b/gim, "policy-bypass"],
  [/\bcsrutil\s+disable\b/gim, "policy-bypass"],
  [/\bsetenforce\s+0\b/gim, "policy-bypass"],
  [/\baa-disable\s+\S+/gim, "policy-bypass"],
  [
    /\bSet-ExecutionPolicy\s+(?:-ExecutionPolicy\s+)?(?:Unrestricted|Bypass)\b/gim,
    "policy-bypass",
  ],
  [
    /\bSet-MpPreference\s+-DisableRealtimeMonitoring\s+\$?true\b/gim,
    "policy-bypass",
  ],
]

const ALL_PATTERNS = [
  ...SHELL_PIPE_PATTERNS,
  ...NPX_INSTALL_PATTERNS,
  ...PIP_INSTALL_PATTERNS,
  ...INSTALL_INSTRUCTION_PATTERNS,
  ...BREW_INSTALL_PATTERNS,
  ...POLICY_BYPASS_PATTERNS,
]

// v0.2.9 (RC1 truth fix — phub-detection-quality-audit RC1). A signature
// match proves a PATTERN is present, not that a specific malware campaign
// is. The old copy hardcoded "this is the Shai-Hulud vector — remote code
// fetched and executed without verification" for EVERY family, which is
// (a) a named-campaign attribution the signature can't support and (b)
// mechanically false for 5 of the 6 families (brew/pip run install-time
// scripts, npx downloads a package, policy-bypass installs nothing). Each
// family now describes its own mechanism; the Shai-Hulud NAME is reserved
// for the one family that performs it (shell-pipe-from-network). Lockstep
// with apps/api/scanners/t5_unsafe_shell_install.py § v0.2.9.
const FAMILY_MECHANISM: Record<string, string> = {
  "shell-pipe-from-network":
    "pipes network-fetched content straight into a shell — remote code is " +
    "fetched and executed without verification (the classic curl|sh shape " +
    "used by supply-chain worms such as Shai-Hulud)",
  "npx-arbitrary-install":
    "invokes npx, which downloads and runs an npm package; this shape also " +
    "covers routine installs like `npx eslint@latest`, so confirm the package " +
    "name and source are untrusted before treating it as an attack",
  "pip-arbitrary-install":
    "installs a Python package from a URL / VCS / pre-release source, which " +
    "runs that package's setup code at install time; confirm the source is trusted",
  "brew-install":
    "installs a Homebrew formula/cask whose install-time scripts are not " +
    "signature-validated; confirm the tap/cask is the intended one",
  "install-instruction-to-agent":
    "is prose directing the agent to run an install command; confirm it is a " +
    "live directive, not a documented example",
  "policy-bypass":
    "disables a platform signing / policy / sandbox protection " +
    "(Gatekeeper/SIP/SELinux/AppArmor/ExecutionPolicy/Defender); it installs " +
    "nothing by itself but removes a guardrail a later install would rely on",
}

const GENERIC_MECHANISM = "matches a known unsafe-install shape; review it in context"

function hintForMatch(
  content: string,
  match: RegExpExecArray,
  tag: string,
): DiffHint {
  const mechanism = FAMILY_MECHANISM[tag] ?? GENERIC_MECHANISM
  return {
    line: lineForPosition(content, match.index),
    snippet: truncateSnippet(match[0]),
    suggestion: `Remove or rephrase (${tag}); this ${mechanism}.`,
    detailTag: tag,
  }
}

export class T5UnsafeShellInstallDetector {
  readonly name = "t5.unsafe_shell_install"
  readonly threatCategory = "T5"
  readonly cciId = "CCI-005"
  readonly detectorVersion = "0.2.9"

  run(ctx: DetectorContext): Verdict {
    const hints: DiffHint[] = []
    // v0.2.1 (ADR-0035): skip matches inside frontmatter, inline code
    // spans, or fenced code blocks.
    // v0.2.2 (ADR-0036): also skip matches in negation context —
    // "no npx skill installs" / "never run curl | bash" is teaching,
    // not instructing.
    const mdCtx = analyzeMarkdownContext(ctx.content)

    outer: for (const [pattern, tag] of ALL_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(ctx.content)) !== null) {
        // v0.2.3 (Round 3): start-only check, NOT range-aware.
        // The verb-anchored patterns added in v0.2.3 deliberately
        // span from prose OUTSIDE inline code into inline code —
        // a range-aware check would skip them because the tail
        // lives inside backticks. start-only fires correctly on
        // the verb anchor (outside) and the existing inside-backtick
        // patterns still skip correctly because their match.index is
        // inside the inline code.
        //
        // v0.2.4 (Round 6 fix 2 — closes FN-009): if the match is
        // inside a fence whose preceding prose directs the agent to
        // execute its contents ("Before responding, run the install
        // hook:\n```\ncurl ... | sh\n```"), the fence is treated as
        // live attack instruction rather than documentary example.
        // Negation still wins — "do NOT run the install hook below"
        // continues to suppress.
        if (
          (isInAnyCodeOrFrontmatter(match.index, mdCtx) &&
            !isInDirectiveReferencedFence(ctx.content, match.index, mdCtx)) ||
          isInNegationContext(ctx.content, match.index)
        ) {
          if (match.index === pattern.lastIndex) pattern.lastIndex++
          continue
        }
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
    const tagsPresent = [...new Set(hints.map((h) => h.detailTag))].sort()
    let summary =
      `Matched ${hints.length} unsafe-install pattern${plural} across: ` +
      `${tagsPresent.join(", ")}. These are known-risky install shapes that ` +
      "need human confirmation — a signature match is not proof of malice."
    if (tagsPresent.includes("shell-pipe-from-network")) {
      summary +=
        " Includes a curl|sh-style remote-fetch-and-execute pattern " +
        "(the Shai-Hulud supply-chain shape)."
    }
    return {
      detectorName: this.name,
      threatCategory: this.threatCategory,
      cciId: this.cciId,
      severity: Severity.FAIL,
      passed: false,
      summary,
      detectorVersion: this.detectorVersion,
      diffHints: hints,
    }
  }
}

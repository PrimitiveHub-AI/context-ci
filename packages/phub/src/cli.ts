/**
 * phub CLI orchestrator. Dispatches to scan/verify/init commands.
 *
 * Invoked from bin/phub.js with process.argv.slice(2). Returns the
 * intended process exit code.
 *
 * Exit codes:
 *   0  success / no issues found
 *   1  issues found / verification failed
 *   2  usage error, file not found, parse error
 */

import { parseArgs, UsageError, type FlagSpec } from "./argv.js"
import { auditCommand } from "./commands/audit.js"
import { initCommand } from "./commands/init.js"
import { scanCommand } from "./commands/scan.js"
import { verifyCommand } from "./commands/verify.js"

const VERSION = "0.1.0"

const HELP_TEXT = `phub ${VERSION} — PrimitiveHub CLI

Usage:
  phub <command> [options] [args]

Commands:
  audit [path]         Discover + classify + scan every agent-context artifact under a path
                       (default: current directory). The first active surface — ADR-0025.
  scan <file>          Scan a markdown file for Context CI Top 10 patterns (T1/T2/T5 in v0.1)
  verify <bundle>      Verify a Trust Bundle JSON file (wraps @primitivehub/verify)
  init                 Write a starter AGENTS.md in the current directory
  help [command]       Show help (general or per-command)
  version              Print version

Global flags:
  --json               Output JSON instead of human-readable text
  -h, --help           Show help
  -V, --version        Print version

Run 'phub help <command>' for per-command options.

Docs:
  https://github.com/DevXYZx/primitivehub/tree/main/packages/phub
`

const SCAN_HELP = `phub scan <file>

Scan a markdown file (typically AGENTS.md) for Context CI Top 10
detector matches. Runs T1 prompt-injection, T2 Unicode-steganography,
and T5 unsafe-shell-install detectors in v0.1.

Flags:
  --json                Output JSON (includes policySource + policyAllowed)
  --sarif               Output SARIF 2.1.0 (for GitHub Code Scanning;
                        mutually exclusive with --json)
  --detector=<id>       Restrict to one detector. May be repeated.
                        Accepts detector name (t1.prompt_injection),
                        CCI ID (CCI-001), or threat category (T1).
  --strict              Treat WARN verdicts as FAIL (default: only FAIL exits non-zero)
  --no-fail             Always exit 0, even when detectors flag content.
                        Useful in CI when SARIF upload is the gate
                        and the scan step shouldn't fail the job.
  --allow-fail=<id>     Allow a detector/CCI/threat ID to FAIL without
                        rejecting the scan. May be repeated. Appended
                        to policy.allow as a synthetic entry.
  --policy <path>       Path to .primitivehub/policy.yaml. Without this
                        flag: auto-discover from cwd to git root, then
                        fall back to implicit default. See
                        docs/context-policy-v0.1.md.

Exit codes:
  0   no failures (or --no-fail set, or policy suppressed everything)
  1   one or more detectors flagged content
  2   usage error / file not readable / mutually-exclusive flags /
      invalid policy file
`

const VERIFY_HELP = `phub verify <bundle.json>

Verify a PrimitiveHub Trust Bundle (v0.1 wire format). Wraps
@primitivehub/verify; all verification runs locally — no network
calls. Air-gap safe (Gate G-C 'phub verify --offline' is the
default; the flag is redundant but accepted).

Flags:
  --level=<level>       structural | policy (default) | full
                        - structural: schema + content digest only
                        - policy:     + Context CI policy
                        - full:       + cryptographic steps
                                      (steps 3-6 stubbed in v0.1;
                                       returns *_DEFERRED failures)
  --strict              Treat WARN verdicts as FAIL during policy
  --allow-fail=<id>     Allow a detector or CCI ID to FAIL without
                        rejecting the bundle. May be repeated.
  --offline             No-op (verification is already offline).
  --json                Output JSON

Exit codes:
  0   bundle verified at the requested level
  1   bundle rejected
  2   usage error / file not readable / JSON parse error
`

const AUDIT_HELP = `phub audit [<path>]

Discover every agent-context artifact under <path> (default:
current directory), classify it, digest it (SHA-256), and run the
Context CI detector roster on the text-scannable classes. Emits a
project-level report. ADR-0025.

Lockfile integration (ADR-0026) — \`phub.lock\` is the package-lock.json
equivalent for AI cognition. Stamps every artifact's
(path, classification, digest, attestation-status) into a canonical
JSON file that CI can compare the working tree against.

Discovers (the canonical "what counts as a context artifact" list):
  AGENTS.md, CLAUDE.md (anywhere in the tree)
  .cursorrules, .windsurfrules, .aider.conf.yml, .aiderignore
  .github/copilot-instructions.md
  .claude/{skills,agents,commands}/**/*.md
  .cursor/rules/**/*.{md,mdc}
  **/primitives/**/*.md, **/skills/**/*.md, **/SKILL.md, **/prompts/**/*.md
  **/mcp.json, **/*.mcp.json   (classified, scanner family lands in a future PR)

Skips: node_modules/, .git/, dist/, build/, .next/, coverage/,
target/, __pycache__/, venv/, .venv/, .tox/, .pytest_cache/, .cache/,
and dot-prefixed directories other than the meaningful ones
(.claude/, .cursor/, .github/). Does NOT follow symlinks.

Flags:
  --json                Output JSON (machine-readable inventory + verdicts)
  --sarif               Output SARIF 2.1.0 aggregating findings across
                        every artifact (mutually exclusive with --json).
                        Upload to GitHub Code Scanning the same way
                        as 'phub scan --sarif'.
  --detector=<id>       Restrict to one detector. May be repeated.
  --strict              Treat WARN verdicts as FAIL
  --no-fail             Always exit 0, even on findings (SARIF-gate flow)
  --allow-fail=<id>     Allow a detector/CCI/threat ID to FAIL without
                        rejecting the audit. Repeatable.
  --policy <path>       Path to .primitivehub/policy.yaml. Without this
                        flag: auto-discover then implicit default.
  --max-files=<n>       Hard cap on files visited (default 5000).
  --max-depth=<n>       Hard cap on directory depth (default 12).

Lockfile flags (mutually exclusive among each other):
  --check-lock          Compare the working tree against the lock at
                        .primitivehub/phub.lock (or --lock-path).
                        Exit 1 on drift OR scanner findings; exit 2
                        if the lock is missing or its top10_version
                        differs from the current spec.
  --update-lock         Write a fresh lock at .primitivehub/phub.lock
                        (or --lock-path). Scanner findings do NOT
                        block the write; the lock pins state, not
                        verdicts.
  --lock-only           Skip the scanner roster; only stamp the lock.
                        Equivalent to --update-lock + skipping scans.
                        Combined with --json, the lock is written to
                        stdout instead of disk.
  --lock-path <path>    Override the auto-discovered lock location.

Exit codes:
  0   no artifacts flagged, no drift (or --no-fail set)
  1   one or more artifacts flagged OR drift detected (--check-lock)
  2   usage error / unreadable path / invalid policy / missing lock
      under --check-lock / spec-version mismatch under --check-lock
`

const INIT_HELP = `phub init

Write a starter AGENTS.md template into the current directory.

Flags:
  --force               Overwrite an existing AGENTS.md
  --json                (Ignored — init has no machine output beyond exit code.)

Exit codes:
  0   wrote AGENTS.md
  2   AGENTS.md already exists (use --force to overwrite)
`

const GLOBAL_SPECS: readonly FlagSpec[] = [
  { name: "json" },
  { name: "sarif" },
  { name: "no-fail" },
  { name: "help", alias: "h" },
  { name: "version", alias: "V" },
  { name: "level", takesValue: true },
  { name: "strict" },
  { name: "allow-fail", takesValue: true, multiple: true },
  { name: "detector", takesValue: true, multiple: true },
  { name: "policy", takesValue: true },
  { name: "force" },
  { name: "offline" },
  { name: "max-files", takesValue: true },
  { name: "max-depth", takesValue: true },
  { name: "check-lock" },
  { name: "update-lock" },
  { name: "lock-only" },
  { name: "lock-path", takesValue: true },
]

function printHelp(command?: string): void {
  switch (command) {
    case "audit":
      process.stdout.write(AUDIT_HELP)
      return
    case "scan":
      process.stdout.write(SCAN_HELP)
      return
    case "verify":
      process.stdout.write(VERIFY_HELP)
      return
    case "init":
      process.stdout.write(INIT_HELP)
      return
    default:
      process.stdout.write(HELP_TEXT)
      return
  }
}

function asPositiveInt(v: unknown, flagName: string): number | undefined {
  if (typeof v !== "string") return undefined
  const n = Number.parseInt(v, 10)
  if (!Number.isFinite(n) || n <= 0) {
    throw new UsageError(`flag --${flagName} requires a positive integer (got ${JSON.stringify(v)})`)
  }
  return n
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string")
  if (typeof v === "string") return [v]
  return []
}

function asBool(v: unknown): boolean {
  return v === true
}

export async function main(argv: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseArgs(argv, GLOBAL_SPECS)
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`phub: ${err.message}\n`)
      return 2
    }
    throw err
  }

  if (asBool(parsed.flags["version"]) && parsed.command === "") {
    process.stdout.write(`${VERSION}\n`)
    return 0
  }
  if (asBool(parsed.flags["help"]) && parsed.command === "") {
    printHelp()
    return 0
  }
  if (parsed.command === "") {
    printHelp()
    return 0
  }

  switch (parsed.command) {
    case "version":
      process.stdout.write(`${VERSION}\n`)
      return 0

    case "help":
      printHelp(parsed.positionals[0])
      return 0

    case "audit": {
      if (asBool(parsed.flags["help"])) {
        printHelp("audit")
        return 0
      }
      const wantsJson = asBool(parsed.flags["json"])
      const wantsSarif = asBool(parsed.flags["sarif"])
      if (wantsJson && wantsSarif) {
        process.stderr.write("phub audit: --json and --sarif are mutually exclusive.\n")
        return 2
      }
      let maxFiles: number | undefined
      let maxDepth: number | undefined
      try {
        maxFiles = asPositiveInt(parsed.flags["max-files"], "max-files")
        maxDepth = asPositiveInt(parsed.flags["max-depth"], "max-depth")
      } catch (err) {
        if (err instanceof UsageError) {
          process.stderr.write(`phub audit: ${err.message}\n`)
          return 2
        }
        throw err
      }
      const lockFlagsSet = [
        asBool(parsed.flags["check-lock"]),
        asBool(parsed.flags["update-lock"]),
        asBool(parsed.flags["lock-only"]),
      ].filter(Boolean).length
      if (lockFlagsSet > 1) {
        process.stderr.write(
          "phub audit: --check-lock, --update-lock, and --lock-only are mutually exclusive.\n",
        )
        return 2
      }
      let lockMode: "check" | "update" | "lock-only" | "off" = "off"
      if (asBool(parsed.flags["check-lock"])) lockMode = "check"
      else if (asBool(parsed.flags["update-lock"])) lockMode = "update"
      else if (asBool(parsed.flags["lock-only"])) lockMode = "lock-only"
      const auditOpts: Parameters<typeof auditCommand>[1] = {
        json: wantsJson,
        sarif: wantsSarif,
        strict: asBool(parsed.flags["strict"]),
        detectors: asStringArray(parsed.flags["detector"]),
        allowFailFor: asStringArray(parsed.flags["allow-fail"]),
        maxFiles: maxFiles ?? 5000,
        maxDepth: maxDepth ?? 12,
        lockMode,
      }
      const policyPath = asString(parsed.flags["policy"])
      if (policyPath !== undefined) auditOpts.policyPath = policyPath
      const lockPath = asString(parsed.flags["lock-path"])
      if (lockPath !== undefined) auditOpts.lockPath = lockPath
      const exit = auditCommand(parsed.positionals[0], auditOpts)
      if (asBool(parsed.flags["no-fail"]) && exit === 1) return 0
      return exit
    }

    case "scan": {
      if (asBool(parsed.flags["help"])) {
        printHelp("scan")
        return 0
      }
      const file = parsed.positionals[0]
      if (file === undefined) {
        process.stderr.write("phub scan: missing <file> argument.\nphub scan <file>\n")
        return 2
      }
      const wantsJson = asBool(parsed.flags["json"])
      const wantsSarif = asBool(parsed.flags["sarif"])
      if (wantsJson && wantsSarif) {
        process.stderr.write("phub scan: --json and --sarif are mutually exclusive.\n")
        return 2
      }
      const scanOpts = {
        json: wantsJson,
        sarif: wantsSarif,
        strict: asBool(parsed.flags["strict"]),
        detectors: asStringArray(parsed.flags["detector"]),
        allowFail: asStringArray(parsed.flags["allow-fail"]),
      } as Parameters<typeof scanCommand>[1]
      const policyPath = asString(parsed.flags["policy"])
      if (policyPath !== undefined) scanOpts.policyPath = policyPath
      const exit = scanCommand(file, scanOpts)
      // --no-fail: suppress exit 1 (findings) but preserve exit 2 (errors).
      if (asBool(parsed.flags["no-fail"]) && exit === 1) return 0
      return exit
    }

    case "verify": {
      if (asBool(parsed.flags["help"])) {
        printHelp("verify")
        return 0
      }
      const file = parsed.positionals[0]
      if (file === undefined) {
        process.stderr.write("phub verify: missing <bundle.json> argument.\nphub verify <bundle.json>\n")
        return 2
      }
      const levelArg = asString(parsed.flags["level"]) ?? "policy"
      if (levelArg !== "structural" && levelArg !== "policy" && levelArg !== "full") {
        process.stderr.write(
          `phub verify: --level must be one of structural|policy|full (got ${JSON.stringify(levelArg)})\n`,
        )
        return 2
      }
      return verifyCommand(file, {
        level: levelArg,
        strict: asBool(parsed.flags["strict"]),
        allowFailFor: asStringArray(parsed.flags["allow-fail"]),
        json: asBool(parsed.flags["json"]),
      })
    }

    case "init": {
      if (asBool(parsed.flags["help"])) {
        printHelp("init")
        return 0
      }
      return initCommand({
        force: asBool(parsed.flags["force"]),
        cwd: process.cwd(),
      })
    }

    default:
      process.stderr.write(`phub: unknown command '${parsed.command}'\n`)
      printHelp()
      return 2
  }
}

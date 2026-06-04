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
import { cbomCommand } from "./commands/cbom.js"
import { initCommand } from "./commands/init.js"
import { installCommand } from "./commands/install.js"
import { scanCommand } from "./commands/scan.js"
import { verifyCommand } from "./commands/verify.js"
import { watchCommand } from "./commands/watch.js"

const VERSION = "0.1.0"

const HELP_TEXT = `phub ${VERSION} — PrimitiveHub CLI

Usage:
  phub <command> [options] [args]

Commands:
  audit [path]         Discover + classify + scan every agent-context artifact under a path
                       (default: current directory). The first active surface — ADR-0025.
  watch [path]         Daemonized filesystem guardian — runs audit on every fs event.
                       ADR-0027. --once for a single audit + exit.
  install <slug@semver>  Safe-install a context primitive — verify + write + lock.
                       ADR-0028. Also: --bundle <path> | --url <url>.
  cbom [path]          Emit a Context Bill of Materials (CBOM v0.1) for the
                       workspace. ADR-0033. JSON inventory of every
                       agent-context artifact.
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

const WATCH_HELP = `phub watch [dir]

Active filesystem guardian. Reuses the same classifier + detector
roster + policy + lock comparison as 'phub audit', but reacts to
fs events instead of running point-in-time.

Two modes:
  default (daemon)   Run an initial audit, then watch for fs events.
                     Emits NDJSON (with --json) or human lines per event.
                     Exits on SIGINT / SIGTERM. Exit code reflects the
                     worst finding observed.
  --once             Run a single audit + emit + exit (same shape as
                     'phub audit'; useful for tests + CI smoke).

Flags:
  --json                  Emit NDJSON event stream (one JSON object per line)
  --once                  Single audit + exit (no fs.watch)
  --debounce <ms>         Per-path debounce in milliseconds (default 200)
  --policy <path>         Path to .primitivehub/policy.yaml. Auto-discover if absent.
  --strict                Treat WARN as FAIL.
  --allow-fail=<id>       Allow detector/CCI/threat ID to FAIL. Repeatable.
  --detector=<id>         Restrict to a detector. Repeatable.
  --max-files <N>         Walker cap. Default 10000.
  --max-depth <N>         Walker cap. Default 16.
  --max-runtime-sec <N>   Exit cleanly after N seconds (test/CI helper).
                          Daemon mode default: no limit.
  --quarantine            v0.1 marker only — real file moves land in v0.2.

Exit codes:
  0   no flagged artifacts (daemon: at exit time)
  1   one or more artifacts flagged by their policy-adjusted verdicts
  2   usage error / unreadable root / invalid policy
`

const INSTALL_HELP = `phub install <slug@semver> | --bundle <path> | --url <url>

Safe-install a context primitive. Replaces the T5 attack class
(curl|bash, npx <evil>, pip install <url>) with a verify-then-write
pipeline. ADR-0028.

Three sources, mutually exclusive:
  positional <slug@semver>    Fetch from a registry (default https://registry.primitivehub.ai)
  --bundle <path>             Use a local Trust Bundle JSON file
  --url <url>                 Fetch a Trust Bundle from an arbitrary URL

Flags:
  --registry <base-url>       Override the default registry. Required pre-launch.
  --install-dir <rel>         Where installed primitives land under the workspace.
                              Default: .primitivehub/installed
  --lock-path <path>          Lock file to update. Default <workspace>/.primitivehub/phub.lock.
  --no-lock                   Don't update the lock (useful for ephemeral installs).
  --force                     Overwrite an existing install path.
  --level=<level>             Verification level (structural | policy | full). Default 'policy'.
  --fetch-timeout-ms <N>      HTTP timeout for --url / registry sources. Default 10000.
  --json                      Emit JSON instead of human-readable output.

Lock attestation written by source:
  positional <slug@semver>    'registry:<slug>@<semver>'
  --bundle <path>             'local:<path>'
  --url <url>                 'url:<url>'

Exit codes:
  0   installed successfully + lock updated
  1   refused (e.g. ALREADY_INSTALLED — pass --force to overwrite)
  2   bundle rejected / source error / write error / usage error
`

const CBOM_HELP = `phub cbom [<path>]

Emit a Context Bill of Materials (CBOM v0.1) for the workspace.
ADR-0033. The third pillar of the Trust Runtime (alongside the
Trust Contract and the Context CI Top 10): a vendor-neutral,
content-addressed inventory of every agent-context artifact loaded
by the project's AI agents.

The CBOM is canonical-JSON: alphabetic keys at every nesting level,
2-space indent, trailing newline, no timestamps. Re-running against
an unchanged workspace yields a byte-identical document (the same
reproducibility property as phub.lock).

When a phub.lock is present at .primitivehub/phub.lock (or
--lock-path), each component's attestation field is copied from the
matching lock entry so the CBOM and lock agree on provenance state.

Flags:
  --output <file>       Write CBOM JSON to <file> instead of stdout.
                        Parent directories are created if missing.
                        Mutually exclusive with --verify.
  --verify <cbom-path>  Consumer-side verification (spec § 8).
                        Parses the stored CBOM, walks the workspace,
                        diffs the two against the four drift
                        dimensions (added / removed / modified /
                        reclassified). Exits 1 on any drift.
                        Mutually exclusive with --output / --format.
  --format <fmt>        Output format. One of:
                          cbom       Native CBOM v0.1 (default)
                          spdx       SPDX 2.3 JSON projection
                          cyclonedx  CycloneDX 1.5 JSON projection
                        SPDX and CycloneDX are lossy projections for
                        enterprise SBOM pipelines that already speak
                        those formats. Both preserve the byte-identical
                        re-stamp property — URN / namespace fields are
                        derived from SHA-256 of the native CBOM bytes.
  --lock-path <path>    Override the auto-discovered phub.lock used
                        for attestation cross-referencing.
  --subject-name <name> Populate the subject.name field. Default: omitted.
  --max-files=<n>       Hard cap on files visited (default 5000).
  --max-depth=<n>       Hard cap on directory depth (default 12).

Exit codes:
  0   CBOM emitted (default) / verification passed (--verify) with no drift
  1   drift detected under --verify
  2   usage error / unreadable path / invalid lock under --lock-path /
      invalid --format value / unreadable or malformed --verify input /
      mutually exclusive flags combined
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
  { name: "once" },
  { name: "debounce", takesValue: true },
  { name: "quarantine" },
  { name: "max-runtime-sec", takesValue: true },
  { name: "bundle", takesValue: true },
  { name: "url", takesValue: true },
  { name: "registry", takesValue: true },
  { name: "install-dir", takesValue: true },
  { name: "no-lock" },
  { name: "fetch-timeout-ms", takesValue: true },
  { name: "output", takesValue: true },
  { name: "subject-name", takesValue: true },
  { name: "format", takesValue: true },
  { name: "verify", takesValue: true },
]

function printHelp(command?: string): void {
  switch (command) {
    case "audit":
      process.stdout.write(AUDIT_HELP)
      return
    case "watch":
      process.stdout.write(WATCH_HELP)
      return
    case "install":
      process.stdout.write(INSTALL_HELP)
      return
    case "cbom":
      process.stdout.write(CBOM_HELP)
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

    case "watch": {
      if (asBool(parsed.flags["help"])) {
        printHelp("watch")
        return 0
      }
      let debounceMs: number
      let maxFiles: number
      let maxDepth: number
      let maxRuntimeSec: number | undefined
      try {
        debounceMs = asPositiveInt(parsed.flags["debounce"], "debounce") ?? 200
        maxFiles = asPositiveInt(parsed.flags["max-files"], "max-files") ?? 10000
        maxDepth = asPositiveInt(parsed.flags["max-depth"], "max-depth") ?? 16
        maxRuntimeSec = asPositiveInt(parsed.flags["max-runtime-sec"], "max-runtime-sec")
      } catch (err) {
        if (err instanceof UsageError) {
          process.stderr.write(`phub watch: ${err.message}\n`)
          return 2
        }
        throw err
      }
      const watchOpts = {
        json: asBool(parsed.flags["json"]),
        once: asBool(parsed.flags["once"]),
        debounceMs,
        strict: asBool(parsed.flags["strict"]),
        detectors: asStringArray(parsed.flags["detector"]),
        allowFail: asStringArray(parsed.flags["allow-fail"]),
        maxFiles,
        maxDepth,
        quarantine: asBool(parsed.flags["quarantine"]),
      } as Parameters<typeof watchCommand>[1]
      const policyPath = asString(parsed.flags["policy"])
      if (policyPath !== undefined) watchOpts.policyPath = policyPath
      if (maxRuntimeSec !== undefined) watchOpts.maxRuntimeSec = maxRuntimeSec
      return await watchCommand(parsed.positionals[0], watchOpts)
    }

    case "cbom": {
      if (asBool(parsed.flags["help"])) {
        printHelp("cbom")
        return 0
      }
      let maxFiles: number | undefined
      let maxDepth: number | undefined
      try {
        maxFiles = asPositiveInt(parsed.flags["max-files"], "max-files")
        maxDepth = asPositiveInt(parsed.flags["max-depth"], "max-depth")
      } catch (err) {
        if (err instanceof UsageError) {
          process.stderr.write(`phub cbom: ${err.message}\n`)
          return 2
        }
        throw err
      }
      const cbomOpts: Parameters<typeof cbomCommand>[1] = {
        maxFiles: maxFiles ?? 5000,
        maxDepth: maxDepth ?? 12,
      }
      const lockPath = asString(parsed.flags["lock-path"])
      if (lockPath !== undefined) cbomOpts.lockPath = lockPath
      const subjectName = asString(parsed.flags["subject-name"])
      if (subjectName !== undefined) cbomOpts.subjectName = subjectName
      const output = asString(parsed.flags["output"])
      if (output !== undefined) cbomOpts.output = output
      const formatArg = asString(parsed.flags["format"])
      if (formatArg !== undefined) {
        if (formatArg !== "cbom" && formatArg !== "spdx" && formatArg !== "cyclonedx") {
          process.stderr.write(
            `phub cbom: --format must be one of cbom|spdx|cyclonedx (got ${JSON.stringify(formatArg)})\n`,
          )
          return 2
        }
        cbomOpts.format = formatArg
      }
      const verifyArg = asString(parsed.flags["verify"])
      if (verifyArg !== undefined) {
        if (formatArg !== undefined) {
          process.stderr.write(
            "phub cbom: --verify and --format are mutually exclusive (verify reads a stored CBOM; format selects an emission).\n",
          )
          return 2
        }
        if (output !== undefined) {
          process.stderr.write(
            "phub cbom: --verify and --output are mutually exclusive (verify writes a drift report, not a CBOM).\n",
          )
          return 2
        }
        cbomOpts.verifyPath = verifyArg
      }
      return cbomCommand(parsed.positionals[0], cbomOpts)
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

    case "install": {
      if (asBool(parsed.flags["help"])) {
        printHelp("install")
        return 0
      }
      let fetchTimeoutMs: number | undefined
      try {
        fetchTimeoutMs = asPositiveInt(parsed.flags["fetch-timeout-ms"], "fetch-timeout-ms")
      } catch (err) {
        if (err instanceof UsageError) {
          process.stderr.write(`phub install: ${err.message}\n`)
          return 2
        }
        throw err
      }
      const slugSemverArg = parsed.positionals[0]
      const installOpts = {
        json: asBool(parsed.flags["json"]),
        force: asBool(parsed.flags["force"]),
        noLock: asBool(parsed.flags["no-lock"]),
      } as Parameters<typeof installCommand>[0]
      const bundlePath = asString(parsed.flags["bundle"])
      const bundleUrl = asString(parsed.flags["url"])
      const registry = asString(parsed.flags["registry"])
      const installDir = asString(parsed.flags["install-dir"])
      const lockPath = asString(parsed.flags["lock-path"])
      const levelArg = asString(parsed.flags["level"])
      if (slugSemverArg !== undefined) installOpts.slugSemver = slugSemverArg
      if (bundlePath !== undefined) installOpts.bundlePath = bundlePath
      if (bundleUrl !== undefined) installOpts.bundleUrl = bundleUrl
      if (registry !== undefined) installOpts.registry = registry
      if (installDir !== undefined) installOpts.installRootRel = installDir
      if (lockPath !== undefined) installOpts.lockPath = lockPath
      if (fetchTimeoutMs !== undefined) installOpts.fetchTimeoutMs = fetchTimeoutMs
      if (levelArg !== undefined) {
        if (levelArg !== "structural" && levelArg !== "policy" && levelArg !== "full") {
          process.stderr.write(
            `phub install: --level must be one of structural|policy|full (got ${JSON.stringify(levelArg)})\n`,
          )
          return 2
        }
        installOpts.level = levelArg
      }
      return await installCommand(installOpts)
    }

    default:
      process.stderr.write(`phub: unknown command '${parsed.command}'\n`)
      printHelp()
      return 2
  }
}

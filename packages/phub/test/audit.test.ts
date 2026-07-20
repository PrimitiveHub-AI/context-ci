/**
 * End-to-end tests for `phub audit` via `main(...)`.
 *
 * Builds throwaway artifact trees in a tmpdir, runs the CLI in-process
 * with stdout/stderr captured, asserts on shape + exit code.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { main } from "../src/cli.js"
import { runAudit } from "../src/commands/audit.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const T1_FIXTURE_TEXT = readFileSync(join(__dirname, "fixtures/t1-prompt-injection.md"), "utf8")
const CLEAN_FIXTURE_TEXT = readFileSync(join(__dirname, "fixtures/clean.md"), "utf8")

interface Captured {
  stdout: string
  stderr: string
}

function captureIo(): Captured & { restore(): void } {
  const origOut = process.stdout.write.bind(process.stdout)
  const origErr = process.stderr.write.bind(process.stderr)
  const captured: Captured = { stdout: "", stderr: "" }
  process.stdout.write = ((chunk: string | Uint8Array) => {
    captured.stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    captured.stderr += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString()
    return true
  }) as typeof process.stderr.write
  return {
    get stdout() { return captured.stdout },
    get stderr() { return captured.stderr },
    restore() {
      process.stdout.write = origOut
      process.stderr.write = origErr
    },
  }
}

function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "phub-audit-e2e-"))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    mkdirSync(join(abs, ".."), { recursive: true })
    writeFileSync(abs, content)
  }
  return root
}

describe("phub audit (programmatic runAudit)", () => {
  let root: string

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("surfaces executable scripts as uncovered (not as clean, not as flagged)", () => {
    // A skill that ships scripts: phub audit reviews the SKILL.md but the
    // scripts are the real T5 surface it does NOT cover. They must be
    // reported as uncovered, not silently dropped — so "clean" can never
    // be misread as "safe". (Regression for the skill-consumption gap,
    // ledger SK-002/SK-004.)
    root = makeTree({
      "skills/demo/SKILL.md": CLEAN_FIXTURE_TEXT,
      "skills/demo/install.sh": "#!/usr/bin/env bash\necho hi\n",
      "scripts/server.cjs": "console.log('x')\n",
      "assets/logo.png": "binary-ish",
      "README.md": "not an artifact",
    })
    const r = runAudit(root, {
      json: false,
      sarif: false,
      strict: false,
      maxFiles: 5000,
      maxDepth: 12,
    })
    // Scripts are surfaced as uncovered surface...
    const uncoveredPaths = r.uncovered.map((u) => u.path).sort()
    expect(uncoveredPaths).toEqual(["scripts/server.cjs", "skills/demo/install.sh"])
    expect(r.uncovered.every((u) => u.kind === "executable")).toBe(true)
    // ...but they are NOT artifacts, NOT scanned, and do NOT flag the run.
    expect(r.artifacts.find((a) => a.path.endsWith(".sh"))).toBeUndefined()
    expect(r.artifacts.find((a) => a.path.endsWith(".cjs"))).toBeUndefined()
    expect(r.exitCode).toBe(0)
    expect(r.summary.flaggedArtifacts).toBe(0)
    // Inert files (image, README) are neither artifacts nor uncovered.
    expect(uncoveredPaths.find((p) => p.endsWith(".png"))).toBeUndefined()
    expect(uncoveredPaths.find((p) => p.endsWith("README.md"))).toBeUndefined()
  })

  it("inventories every artifact class found and skips noise", () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      "CLAUDE.md": CLEAN_FIXTURE_TEXT,
      ".claude/skills/code-review.md": CLEAN_FIXTURE_TEXT,
      ".claude/agents/explore.md": CLEAN_FIXTURE_TEXT,
      ".cursorrules": "do good things",
      "apps/web/content/primitives/safe.md": CLEAN_FIXTURE_TEXT,
      "mcp.json": '{"name":"foo"}',
      "node_modules/junk/lib.js": "ignored",
      "README.md": "not an artifact",
    })
    const r = runAudit(root, {
      json: false,
      sarif: false,
      strict: false,
      maxFiles: 5000,
      maxDepth: 12,
    })
    const classes = r.artifacts.map((a) => a.classification).sort()
    expect(classes).toEqual([
      "agents-md",
      "claude-agent",
      "claude-md",
      "claude-skill",
      "cursor-rules",
      "mcp-config",
      "primitive",
    ])
    // README.md and node_modules/* are not classified.
    expect(r.artifacts.find((a) => a.path === "README.md")).toBeUndefined()
    expect(r.artifacts.find((a) => a.path.startsWith("node_modules/"))).toBeUndefined()
    // mcp.json is in the inventory but NOT scanned.
    const mcp = r.artifacts.find((a) => a.classification === "mcp-config")
    expect(mcp).toBeDefined()
    expect(mcp?.scanned).toBe(false)
    expect(mcp?.verdicts).toEqual([])
    // Clean inputs produce a clean project verdict.
    expect(r.exitCode).toBe(0)
    expect(r.summary.flaggedArtifacts).toBe(0)
  })

  it("flags an artifact with a T1 hit and emits a non-zero exit", () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".claude/skills/evil.md": T1_FIXTURE_TEXT,
    })
    const r = runAudit(root, {
      json: false,
      sarif: false,
      strict: false,
      maxFiles: 5000,
      maxDepth: 12,
    })
    expect(r.exitCode).toBe(1)
    expect(r.summary.flaggedArtifacts).toBe(1)
    const evil = r.artifacts.find((a) => a.path.endsWith("evil.md"))
    expect(evil).toBeDefined()
    expect(evil?.flagged).toBe(true)
    expect(evil?.classification).toBe("claude-skill")
    // SHA-256 of the fixture text is non-empty hex.
    expect(evil?.digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it("supports --detector restriction (only the named detector runs)", () => {
    root = makeTree({ ".claude/skills/evil.md": T1_FIXTURE_TEXT })
    const r = runAudit(root, {
      json: false,
      sarif: false,
      detectors: ["CCI-002"],
      strict: false,
      maxFiles: 5000,
      maxDepth: 12,
    })
    const a = r.artifacts[0]!
    expect(a.verdicts).toHaveLength(1)
    expect(a.verdicts[0]?.cciId).toBe("CCI-002")
  })
})

describe("phub audit (CLI via main)", () => {
  let io: ReturnType<typeof captureIo>
  let root: string

  beforeEach(() => {
    io = captureIo()
  })
  afterEach(() => {
    io.restore()
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("exit 0 on a clean project + prints inventory + 'artifacts clean'", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".cursorrules": "be careful",
    })
    const code = await main(["audit", root])
    expect(code).toBe(0)
    expect(io.stdout).toMatch(/Inventory \(2 artifacts/)
    expect(io.stdout).toMatch(/agents-md/)
    expect(io.stdout).toMatch(/cursor-rules/)
    expect(io.stdout).toMatch(/artifacts clean/)
  })

  it("exit 1 + structured Findings block on T1 content under .claude/skills/", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".claude/skills/evil.md": T1_FIXTURE_TEXT,
    })
    const code = await main(["audit", root])
    expect(code).toBe(1)
    expect(io.stdout).toMatch(/Findings:/)
    expect(io.stdout).toMatch(/\[FAIL\] .*evil\.md \(claude-skill\)/)
    expect(io.stdout).toMatch(/\[FAIL\] t1\.prompt_injection \(CCI-001\)/)
  })

  it("--json emits parseable inventory + verdicts + summary", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".claude/skills/evil.md": T1_FIXTURE_TEXT,
    })
    const code = await main(["audit", root, "--json"])
    expect(code).toBe(1)
    const parsed = JSON.parse(io.stdout)
    expect(parsed.root).toBe(root)
    expect(parsed.artifacts.length).toBe(2)
    const evil = parsed.artifacts.find(
      (a: { path: string }) => a.path.endsWith("evil.md"),
    )
    expect(evil.classification).toBe("claude-skill")
    expect(evil.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(evil.flagged).toBe(true)
    expect(parsed.summary.flaggedArtifacts).toBe(1)
    expect(parsed.summary.totalArtifacts).toBe(2)
  })

  it("--sarif emits a valid SARIF aggregating across artifacts", async () => {
    root = makeTree({
      "AGENTS.md": T1_FIXTURE_TEXT,
      ".claude/skills/evil.md": T1_FIXTURE_TEXT,
    })
    const code = await main(["audit", root, "--sarif"])
    expect(code).toBe(1)
    const parsed = JSON.parse(io.stdout)
    expect(parsed.version).toBe("2.1.0")
    expect(parsed.runs[0].tool.driver.name).toBe("phub")
    const uris: string[] = parsed.runs[0].results.map(
      (r: { locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }) =>
        r.locations[0].physicalLocation.artifactLocation.uri,
    )
    // Multi-file aggregation: both files appear in the same SARIF doc.
    expect(uris).toContain("AGENTS.md")
    expect(uris.some((u) => u.endsWith("evil.md"))).toBe(true)
  })

  it("--json and --sarif together is a usage error (exit 2)", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const code = await main(["audit", root, "--json", "--sarif"])
    expect(code).toBe(2)
    expect(io.stderr).toMatch(/mutually exclusive/)
  })

  it("--no-fail suppresses exit 1 on findings", async () => {
    root = makeTree({ "AGENTS.md": T1_FIXTURE_TEXT })
    const code = await main(["audit", root, "--no-fail"])
    expect(code).toBe(0)
  })

  it("--max-files truncates and reports the truncation in human output", async () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 12; i++) {
      files[`primitives/p${i}.md`] = CLEAN_FIXTURE_TEXT
    }
    root = makeTree(files)
    const code = await main(["audit", root, "--max-files", "3"])
    expect(code).toBe(0)
    expect(io.stdout).toMatch(/file-limit reached/)
  })

  it("rejects --max-files=<non-positive>", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const code = await main(["audit", root, "--max-files", "0"])
    expect(code).toBe(2)
    expect(io.stderr).toMatch(/max-files/)
  })

  it("help text is reachable via 'phub help audit'", async () => {
    const code = await main(["help", "audit"])
    expect(code).toBe(0)
    expect(io.stdout).toMatch(/phub audit \[<path>\]/)
    expect(io.stdout).toMatch(/Discovers \(the canonical/)
    expect(io.stdout).toMatch(/Lockfile flags/)
  })
})

describe("phub audit --update-lock / --check-lock (lockfile flow)", () => {
  let io: ReturnType<typeof captureIo>
  let root: string

  beforeEach(() => {
    io = captureIo()
  })
  afterEach(() => {
    io.restore()
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("--update-lock writes .primitivehub/phub.lock + exit 0", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".cursorrules": "be careful",
    })
    const code = await main(["audit", root, "--update-lock"])
    expect(code).toBe(0)
    const lockPath = join(root, ".primitivehub", "phub.lock")
    const content = readFileSync(lockPath, "utf8")
    const parsed = JSON.parse(content)
    expect(parsed.version).toBe("0.1")
    expect(parsed.artifacts.map((a: { path: string }) => a.path).sort()).toEqual([".cursorrules", "AGENTS.md"])
    expect(io.stdout).toMatch(/Wrote lock/)
  })

  it("--check-lock against missing lock returns exit 2", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const code = await main(["audit", root, "--check-lock"])
    expect(code).toBe(2)
    expect(io.stderr).toMatch(/no lock to check against/)
  })

  it("round-trip: update-lock then check-lock = exit 0 no drift", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".claude/skills/foo.md": CLEAN_FIXTURE_TEXT,
    })
    const updateCode = await main(["audit", root, "--update-lock"])
    expect(updateCode).toBe(0)
    io.restore()
    io = captureIo()
    const checkCode = await main(["audit", root, "--check-lock"])
    expect(checkCode).toBe(0)
    expect(io.stdout).toMatch(/Lock match/)
    expect(io.stdout).toMatch(/no drift/)
  })

  it("--check-lock detects added artifact + exit 1", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    await main(["audit", root, "--update-lock"])
    io.restore()
    io = captureIo()
    // Now add a new artifact.
    writeFileSync(join(root, ".cursorrules"), "new")
    const code = await main(["audit", root, "--check-lock"])
    expect(code).toBe(1)
    expect(io.stdout).toMatch(/Drift detected/)
    expect(io.stdout).toMatch(/Added \(1\)/)
    expect(io.stdout).toMatch(/\.cursorrules/)
  })

  it("--check-lock detects modified digest + exit 1", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    await main(["audit", root, "--update-lock"])
    io.restore()
    io = captureIo()
    writeFileSync(join(root, "AGENTS.md"), CLEAN_FIXTURE_TEXT + "\n// modified\n")
    const code = await main(["audit", root, "--check-lock"])
    expect(code).toBe(1)
    expect(io.stdout).toMatch(/Modified \(1\)/)
    expect(io.stdout).toMatch(/sha256:/)
  })

  it("--check-lock detects removed artifact + exit 1", async () => {
    root = makeTree({
      "AGENTS.md": CLEAN_FIXTURE_TEXT,
      ".cursorrules": "foo",
    })
    await main(["audit", root, "--update-lock"])
    io.restore()
    io = captureIo()
    rmSync(join(root, ".cursorrules"))
    const code = await main(["audit", root, "--check-lock"])
    expect(code).toBe(1)
    expect(io.stdout).toMatch(/Removed \(1\)/)
    expect(io.stdout).toMatch(/\.cursorrules/)
  })

  it("--lock-only writes the lock without running scanners (fast path)", async () => {
    root = makeTree({
      "AGENTS.md": T1_FIXTURE_TEXT, // would normally flag T1
    })
    const code = await main(["audit", root, "--lock-only"])
    // Lock-only skips scanners, so no findings even with T1 fixture content:
    expect(code).toBe(0)
    expect(io.stdout).not.toMatch(/\[FAIL\]/)
    expect(io.stdout).toMatch(/Wrote lock/)
    const lockPath = join(root, ".primitivehub", "phub.lock")
    expect(existsSync(lockPath)).toBe(true)
  })

  it("--lock-only --json writes the lock to stdout (not disk)", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const code = await main(["audit", root, "--lock-only", "--json"])
    expect(code).toBe(0)
    // No disk write under --lock-only --json:
    const lockPath = join(root, ".primitivehub", "phub.lock")
    expect(existsSync(lockPath)).toBe(false)
    // Stdout is the canonical lock JSON:
    const parsed = JSON.parse(io.stdout)
    expect(parsed.version).toBe("0.1")
    expect(parsed.artifacts).toHaveLength(1)
  })

  it("--check-lock and --update-lock together is a usage error", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const code = await main(["audit", root, "--check-lock", "--update-lock"])
    expect(code).toBe(2)
    expect(io.stderr).toMatch(/mutually exclusive/)
  })

  it("--lock-path overrides the default location", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    const customLock = join(root, "custom", "where.lock")
    const code = await main(["audit", root, "--update-lock", "--lock-path", customLock])
    expect(code).toBe(0)
    expect(existsSync(customLock)).toBe(true)
    expect(existsSync(join(root, ".primitivehub", "phub.lock"))).toBe(false)
  })

  it("--check-lock surfaces drift in --json output", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    await main(["audit", root, "--update-lock"])
    writeFileSync(join(root, ".cursorrules"), "new")
    io.restore()
    io = captureIo()
    const code = await main(["audit", root, "--check-lock", "--json"])
    expect(code).toBe(1)
    const parsed = JSON.parse(io.stdout)
    expect(parsed.lock.mode).toBe("check")
    expect(parsed.lock.hasDrift).toBe(true)
    expect(parsed.lock.drift.added[0].path).toBe(".cursorrules")
  })

  it("scanner findings + drift surface together; exit 1 from either", async () => {
    root = makeTree({ "AGENTS.md": CLEAN_FIXTURE_TEXT })
    await main(["audit", root, "--update-lock"])
    // Add a new artifact with adversarial content — triggers both drift AND scan-fail.
    mkdirSync(join(root, ".claude/skills"), { recursive: true })
    writeFileSync(join(root, ".claude/skills/evil.md"), T1_FIXTURE_TEXT)
    io.restore()
    io = captureIo()
    const code = await main(["audit", root, "--check-lock"])
    expect(code).toBe(1)
    expect(io.stdout).toMatch(/Drift detected/)
    expect(io.stdout).toMatch(/Findings:/)
  })
})

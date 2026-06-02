import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  diffLock,
  isLockDrifted,
  lockFromAudit,
  parseLock,
  readLock,
  serializeLock,
  writeLock,
  LockParseError,
  LOCK_VERSION,
  LOCK_TOP10_VERSION,
  LOCK_GENERATOR,
  LOCK_SCHEMA_URL,
  type PhubLock,
} from "../src/audit/lock.js"
import { type AuditedArtifact } from "../src/audit/types.js"

function art(path: string, classification: string, digestHex: string): AuditedArtifact {
  return {
    path,
    classification: classification as AuditedArtifact["classification"],
    digest: digestHex,
    scanned: false,
    verdicts: [],
    adjustedVerdicts: [],
    flagged: false,
  }
}

describe("lockFromAudit", () => {
  it("produces a v0.1 lock with sorted artifacts", () => {
    const lock = lockFromAudit([
      art("CLAUDE.md", "claude-md", "a".repeat(64)),
      art(".cursorrules", "cursor-rules", "b".repeat(64)),
      art("AGENTS.md", "agents-md", "c".repeat(64)),
    ])
    expect(lock.version).toBe(LOCK_VERSION)
    expect(lock.top10_version).toBe(LOCK_TOP10_VERSION)
    expect(lock.generator).toBe(LOCK_GENERATOR)
    expect(lock.root).toBe(".")
    expect(lock.$schema).toBe(LOCK_SCHEMA_URL)
    // Lexicographic order by path:
    expect(lock.artifacts.map((a) => a.path)).toEqual([".cursorrules", "AGENTS.md", "CLAUDE.md"])
    // Every artifact picks up the unattested state in v0.1:
    expect(lock.artifacts.every((a) => a.attestation === "unattested")).toBe(true)
    // Digest gets the sha256: prefix:
    expect(lock.artifacts[0]?.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})

describe("serializeLock — canonical JSON", () => {
  it("emits alphabetically sorted keys at every level", () => {
    const lock = lockFromAudit([art("AGENTS.md", "agents-md", "abc".padEnd(64, "0"))])
    const out = serializeLock(lock)
    // Top-level keys sorted: $schema, artifacts, generator, root, top10_version, version
    const topKeys = Array.from(out.matchAll(/^  "(\$schema|artifacts|generator|root|top10_version|version)":/gm)).map(
      (m) => m[1],
    )
    expect(topKeys).toEqual(["$schema", "artifacts", "generator", "root", "top10_version", "version"])
    // Per-artifact keys also alphabetical: attestation, classification, digest, path
    const inner = out.match(/{\s*"attestation":[^}]+}/)?.[0] ?? ""
    expect(inner).toMatch(/"attestation":[^,]+,\s*"classification":[^,]+,\s*"digest":[^,]+,\s*"path":/)
  })

  it("terminates with a trailing newline", () => {
    const lock = lockFromAudit([])
    expect(serializeLock(lock).endsWith("\n")).toBe(true)
  })

  it("re-serialize is idempotent (byte-identical)", () => {
    const lock = lockFromAudit([
      art("CLAUDE.md", "claude-md", "1".repeat(64)),
      art("AGENTS.md", "agents-md", "2".repeat(64)),
    ])
    const once = serializeLock(lock)
    const twice = serializeLock(lock)
    expect(once).toBe(twice)
  })
})

describe("parseLock", () => {
  it("round-trips a well-formed lock", () => {
    const original = lockFromAudit([art("AGENTS.md", "agents-md", "f".repeat(64))])
    const parsed = parseLock(serializeLock(original), "synthetic")
    expect(parsed).toEqual(original)
  })

  it("throws LockParseError on invalid JSON", () => {
    expect(() => parseLock("not json", "synthetic")).toThrow(LockParseError)
  })

  it("throws LockParseError on missing required fields", () => {
    expect(() => parseLock('{"version":"0.1"}', "synthetic")).toThrow(/top10_version/)
    expect(() =>
      parseLock('{"version":"0.1","top10_version":"0.1","generator":"phub@0.1.0","root":"."}', "synthetic"),
    ).toThrow(/artifacts/)
  })

  it("throws on malformed artifact entry", () => {
    const bad =
      '{"version":"0.1","top10_version":"0.1","generator":"phub@0.1.0","root":".","artifacts":[{"path":"x"}]}'
    expect(() => parseLock(bad, "synthetic")).toThrow(/classification/)
  })
})

describe("readLock + writeLock", () => {
  let root: string
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it("writes + reads round-trip preserves the lock", () => {
    root = mkdtempSync(join(tmpdir(), "phub-lock-rw-"))
    const lockPath = join(root, ".primitivehub", "phub.lock")
    const original = lockFromAudit([
      art("CLAUDE.md", "claude-md", "a".repeat(64)),
      art("AGENTS.md", "agents-md", "b".repeat(64)),
    ])
    writeLock(lockPath, original)
    const onDisk = readFileSync(lockPath, "utf8")
    expect(onDisk.endsWith("\n")).toBe(true)
    const parsed = readLock(lockPath)
    expect(parsed).toEqual(original)
  })

  it("writeLock creates intermediate directories", () => {
    root = mkdtempSync(join(tmpdir(), "phub-lock-mkdir-"))
    const deep = join(root, "a", "b", "c", "phub.lock")
    writeLock(deep, lockFromAudit([]))
    expect(readFileSync(deep, "utf8").startsWith("{")).toBe(true)
  })

  it("readLock throws LockParseError on malformed disk content", () => {
    root = mkdtempSync(join(tmpdir(), "phub-lock-malformed-"))
    const lockPath = join(root, "phub.lock")
    writeFileSync(lockPath, "{not json}")
    expect(() => readLock(lockPath)).toThrow(LockParseError)
  })
})

describe("Reproducibility — byte-identical re-stamps", () => {
  it("two writes of the same artifact set produce identical bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "phub-lock-repro-"))
    try {
      const artifacts = [
        art("CLAUDE.md", "claude-md", "1".repeat(64)),
        art(".cursorrules", "cursor-rules", "2".repeat(64)),
        art("apps/web/AGENTS.md", "agents-md", "3".repeat(64)),
      ]
      const first = join(root, "first.lock")
      const second = join(root, "second.lock")
      writeLock(first, lockFromAudit(artifacts))
      // Build a fresh lock object from the same artifact set (no shared state).
      writeLock(second, lockFromAudit(artifacts.map((a) => ({ ...a }))))
      expect(readFileSync(first, "utf8")).toBe(readFileSync(second, "utf8"))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("artifact array order does not affect the lock bytes", () => {
    const artifacts = [
      art("z.md", "primitive", "1".repeat(64)),
      art("a.md", "primitive", "2".repeat(64)),
    ]
    const a = serializeLock(lockFromAudit(artifacts))
    const b = serializeLock(lockFromAudit([...artifacts].reverse()))
    expect(a).toBe(b)
  })
})

describe("diffLock — drift categorization", () => {
  function lockWith(entries: Array<[string, string, string]>): PhubLock {
    return lockFromAudit(entries.map(([path, cls, digest]) => art(path, cls, digest)))
  }

  it("returns empty drift on identical locks", () => {
    const l = lockWith([["AGENTS.md", "agents-md", "a".repeat(64)]])
    const d = diffLock(l, l)
    expect(d.added).toEqual([])
    expect(d.removed).toEqual([])
    expect(d.modified).toEqual([])
    expect(d.reclassified).toEqual([])
    expect(isLockDrifted(d)).toBe(false)
  })

  it("detects added artifacts", () => {
    const prev = lockWith([["AGENTS.md", "agents-md", "a".repeat(64)]])
    const curr = lockWith([
      ["AGENTS.md", "agents-md", "a".repeat(64)],
      [".claude/skills/new.md", "claude-skill", "b".repeat(64)],
    ])
    const d = diffLock(prev, curr)
    expect(d.added.map((a) => a.path)).toEqual([".claude/skills/new.md"])
    expect(d.removed).toEqual([])
    expect(isLockDrifted(d)).toBe(true)
  })

  it("detects removed artifacts", () => {
    const prev = lockWith([
      ["AGENTS.md", "agents-md", "a".repeat(64)],
      [".cursorrules", "cursor-rules", "b".repeat(64)],
    ])
    const curr = lockWith([["AGENTS.md", "agents-md", "a".repeat(64)]])
    const d = diffLock(prev, curr)
    expect(d.removed.map((r) => r.path)).toEqual([".cursorrules"])
    expect(d.added).toEqual([])
  })

  it("detects modified artifacts via digest change", () => {
    const prev = lockWith([["AGENTS.md", "agents-md", "a".repeat(64)]])
    const curr = lockWith([["AGENTS.md", "agents-md", "b".repeat(64)]])
    const d = diffLock(prev, curr)
    expect(d.modified).toHaveLength(1)
    expect(d.modified[0]?.path).toBe("AGENTS.md")
    expect(d.modified[0]?.fromDigest).toBe(`sha256:${"a".repeat(64)}`)
    expect(d.modified[0]?.toDigest).toBe(`sha256:${"b".repeat(64)}`)
    expect(d.added).toEqual([])
    expect(d.removed).toEqual([])
  })

  it("detects reclassification (path stable, class changed, digest stable)", () => {
    const prev = lockWith([["AGENTS.md", "agents-md", "a".repeat(64)]])
    const curr = lockWith([["AGENTS.md", "primitive", "a".repeat(64)]])
    const d = diffLock(prev, curr)
    expect(d.reclassified).toHaveLength(1)
    expect(d.reclassified[0]?.fromClass).toBe("agents-md")
    expect(d.reclassified[0]?.toClass).toBe("primitive")
    expect(d.modified).toEqual([])
  })

  it("emits drift in lexicographic order", () => {
    const prev = lockWith([])
    const curr = lockWith([
      ["zeta.md", "primitive", "1".repeat(64)],
      ["alpha.md", "primitive", "2".repeat(64)],
      ["beta.md", "primitive", "3".repeat(64)],
    ])
    const d = diffLock(prev, curr)
    expect(d.added.map((a) => a.path)).toEqual(["alpha.md", "beta.md", "zeta.md"])
  })
})

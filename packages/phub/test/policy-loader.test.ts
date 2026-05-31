/**
 * Loader tests + full conformance suite run (valid + invalid fixtures
 * from docs/context-policy/conformance/). Per ADR-0018 + ADR-0021 the
 * suite IS the executable contract; this file ensures the reference
 * implementation passes every fixture.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import {
  loadPolicyFromString,
  loadPolicyFromFile,
  discoverPolicyPath,
  resolvePolicy,
} from "../src/policy/loader.js"
import { PolicyLoadError, IMPLICIT_DEFAULT_POLICY } from "../src/policy/types.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Walk-up discovery mirrors the pattern in conformance.test.ts (verify).
function findConformanceDir(): string {
  let cursor = __dirname
  for (let i = 0; i < 10; i++) {
    const candidate = join(cursor, "docs", "context-policy", "conformance")
    if (existsSync(candidate)) return candidate
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error("could not locate docs/context-policy/conformance")
}

const CONFORMANCE_DIR = findConformanceDir()
const VALID_DIR = join(CONFORMANCE_DIR, "valid")
const INVALID_DIR = join(CONFORMANCE_DIR, "invalid")

function yamlFiles(dir: string): string[] {
  return readdirSync(dir).filter((n) => n.endsWith(".yaml")).sort().map((n) => join(dir, n))
}

/* ---------------- Suite invariants ---------------- */
describe("conformance suite invariants", () => {
  it("locates valid/ and invalid/ directories", () => {
    expect(existsSync(VALID_DIR)).toBe(true)
    expect(existsSync(INVALID_DIR)).toBe(true)
  })

  it("ships >= 6 valid fixtures", () => {
    expect(yamlFiles(VALID_DIR).length).toBeGreaterThanOrEqual(6)
  })

  it("ships >= 3 invalid fixtures", () => {
    expect(yamlFiles(INVALID_DIR).length).toBeGreaterThanOrEqual(3)
  })
})

/* ---------------- Valid fixtures ---------------- */
describe("valid fixtures (loader MUST accept)", () => {
  for (const path of yamlFiles(VALID_DIR)) {
    const name = path.split("/").pop()!
    it(`accepts ${name}`, () => {
      const policy = loadPolicyFromFile(path)
      expect(policy.version).toBe("0.1")
      expect(typeof policy.strict).toBe("boolean")
      expect(Array.isArray(policy.allow)).toBe(true)
      expect(typeof policy.rules).toBe("object")
    })
  }
})

/* ---------------- Invalid fixtures ---------------- */
describe("invalid fixtures (loader MUST reject)", () => {
  for (const path of yamlFiles(INVALID_DIR)) {
    const name = path.split("/").pop()!
    it(`rejects ${name}`, () => {
      expect(() => loadPolicyFromFile(path)).toThrow(PolicyLoadError)
    })
  }
})

/* ---------------- Specific error messages ---------------- */
describe("error messages are descriptive", () => {
  it("missing version → mentions the missing field", () => {
    try {
      loadPolicyFromString("strict: false\n")
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyLoadError)
      expect((err as PolicyLoadError).message).toMatch(/version/)
    }
  })

  it("reserved 'extends' → mentions v0.2", () => {
    try {
      loadPolicyFromString('version: "0.1"\nextends: "x"\n')
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyLoadError)
      expect((err as PolicyLoadError).message).toMatch(/v0\.2/)
    }
  })

  it("wrong version string → mentions the expected const", () => {
    try {
      loadPolicyFromString('version: "0.2"\n')
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyLoadError)
      expect((err as PolicyLoadError).message).toMatch(/0\.1/)
    }
  })

  it("allow missing reason → mentions 'reason'", () => {
    try {
      loadPolicyFromString(
        'version: "0.1"\nallow:\n  - files: ["x"]\n    rules:\n      - id: "CCI-005"\n',
      )
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyLoadError)
      expect((err as PolicyLoadError).message).toMatch(/reason/)
    }
  })
})

/* ---------------- Defaults ---------------- */
describe("default-application", () => {
  it("minimal policy → strict=false, rules={}, allow=[]", () => {
    const p = loadPolicyFromString('version: "0.1"\n')
    expect(p.strict).toBe(false)
    expect(p.rules).toEqual({})
    expect(p.allow).toEqual([])
  })
})

/* ---------------- resolvePolicy ---------------- */
describe("resolvePolicy", () => {
  it("falls back to implicit default when no path + no discovery hit", () => {
    // Use /tmp where there's no .primitivehub/policy.yaml.
    const { policy, source } = resolvePolicy(undefined, "/tmp")
    expect(policy).toEqual(IMPLICIT_DEFAULT_POLICY)
    expect(source).toBe("<implicit-default>")
  })

  it("loads explicit path when provided", () => {
    const path = join(VALID_DIR, "04-claude-md-allow-canonical.yaml")
    const { policy, source } = resolvePolicy(path)
    expect(source).toBe(path)
    expect(policy.allow.length).toBe(1)
  })

  it("throws PolicyLoadError when explicit path is missing", () => {
    expect(() => resolvePolicy("/tmp/no-such-policy.yaml")).toThrow(PolicyLoadError)
  })
})

/* ---------------- discoverPolicyPath ---------------- */
describe("discoverPolicyPath", () => {
  it("returns null when no policy in any ancestor", () => {
    expect(discoverPolicyPath("/tmp")).toBe(null)
  })
})

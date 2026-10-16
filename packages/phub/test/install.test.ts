/**
 * `phub install` tests.
 *
 * Three sources covered:
 *   - --bundle <path>    deterministic local fixture
 *   - --url <url>        spawns a tiny http server in-process
 *   - <slug@semver>      same http server, registry-shaped route
 *
 * Plus refusal paths: bundle rejected by verify, ALREADY_INSTALLED
 * without --force, unsafe slug, path traversal in subject, missing
 * source, ambiguous source.
 */

import { createServer, type Server } from "node:http"
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { AddressInfo } from "node:net"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runInstall } from "../src/commands/install.js"
import {
  parseSlugSemver,
  classifySource,
  InstallSourceError,
} from "../src/install/source.js"
import { InstallWriteError } from "../src/install/writer.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

const REPO_ROOT = findRepoRoot(__dirname)
const VALID_BUNDLE = join(REPO_ROOT, "docs/trust-contract/conformance/valid/01-minimal-valid.json")
const INVALID_BUNDLE = join(REPO_ROOT, "docs/trust-contract/conformance/invalid/01-digest-mismatch.json")

function findRepoRoot(start: string): string {
  let cursor = start
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(cursor, ".primitivehub", "phub.lock"))) return cursor
    const parent = resolve(cursor, "..")
    if (parent === cursor) break
    cursor = parent
  }
  throw new Error("could not locate repo root")
}

function makeTmpWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "phub-install-"))
}

/* ─────────────────────────────────────────────────────────────────── */
describe("parseSlugSemver", () => {
  it("splits at the LAST '@' to support scoped names", () => {
    expect(parseSlugSemver("@scope/name@1.2.3")).toEqual({ slug: "@scope/name", semver: "1.2.3" })
  })

  it("accepts simple slug@semver", () => {
    expect(parseSlugSemver("foo@1.0.0")).toEqual({ slug: "foo", semver: "1.0.0" })
  })

  it("rejects missing semver", () => {
    expect(() => parseSlugSemver("foo@")).toThrow(InstallSourceError)
  })

  it("rejects missing slug", () => {
    expect(() => parseSlugSemver("@1.0.0")).toThrow(InstallSourceError)
  })

  it("rejects path-traversal in slug", () => {
    expect(() => parseSlugSemver("../escape@1.0.0")).toThrow(InstallSourceError)
  })

  it("rejects path-traversal in semver", () => {
    expect(() => parseSlugSemver("foo@../1.0.0")).toThrow(InstallSourceError)
  })
})

/* ─────────────────────────────────────────────────────────────────── */
describe("classifySource", () => {
  it("returns 'bundle-path' for --bundle", () => {
    const s = classifySource({ bundlePath: "/tmp/b.json" })
    expect(s.kind).toBe("bundle-path")
    expect(s.attestation).toBe("local:/tmp/b.json")
  })

  it("returns 'url' for --url", () => {
    const s = classifySource({ bundleUrl: "https://example.com/b.json" })
    expect(s.kind).toBe("url")
    expect(s.attestation).toBe("url:https://example.com/b.json")
  })

  it("returns 'registry' for slug@semver", () => {
    const s = classifySource({ slugSemver: "foo@1.0.0" })
    expect(s.kind).toBe("registry")
    expect(s.attestation).toBe("registry:foo@1.0.0")
  })

  it("rejects no source", () => {
    expect(() => classifySource({})).toThrow(/NO_SOURCE|no source/)
  })

  it("rejects multiple sources at once", () => {
    expect(() => classifySource({ bundlePath: "x", bundleUrl: "y" })).toThrow(
      /AMBIGUOUS|mutually exclusive/,
    )
  })
})

/* ─────────────────────────────────────────────────────────────────── */
describe("runInstall — --bundle source (local file)", () => {
  it("happy path: writes content, updates lock with local: attestation", async () => {
    const ws = makeTmpWorkspace()
    const result = await runInstall({
      json: false,
      workspaceRoot: ws,
      bundlePath: VALID_BUNDLE,
      allowUnauthenticated: true, // v0.1 stubs crypto; no bundle can authenticate
    })
    expect(result.exitCode).toBe(0)
    expect(result.source.kind).toBe("bundle-path")
    expect(result.attestation).toBe(`local:${VALID_BUNDLE}`)
    expect(result.verification.level).toBe("full")
    expect(existsSync(result.installedPath)).toBe(true)
    expect(result.workspaceRelativePath).toBe(
      ".primitivehub/installed/primitives/minimal-primitive/0.1.0/primitive.md",
    )
    // Lock has one entry
    const lock = JSON.parse(readFileSync(result.lockPath!, "utf8"))
    expect(lock.artifacts.length).toBe(1)
    expect(lock.artifacts[0].path).toBe(result.workspaceRelativePath)
    expect(lock.artifacts[0].attestation).toMatch(/^local:/)
    expect(lock.artifacts[0].digest).toMatch(/^sha256:/)
  })

  it("refuses ALREADY_INSTALLED on re-install without --force", async () => {
    const ws = makeTmpWorkspace()
    await runInstall({ json: false, workspaceRoot: ws, bundlePath: VALID_BUNDLE, allowUnauthenticated: true })
    await expect(
      runInstall({ json: false, workspaceRoot: ws, bundlePath: VALID_BUNDLE, allowUnauthenticated: true }),
    ).rejects.toThrow(/already exists/)
  })

  it("accepts re-install with --force", async () => {
    const ws = makeTmpWorkspace()
    await runInstall({ json: false, workspaceRoot: ws, bundlePath: VALID_BUNDLE, allowUnauthenticated: true })
    const result = await runInstall({
      json: false,
      workspaceRoot: ws,
      bundlePath: VALID_BUNDLE,
      force: true,
      allowUnauthenticated: true,
    })
    expect(result.exitCode).toBe(0)
  })

  it("rejects a bundle that fails verification (digest mismatch)", async () => {
    const ws = makeTmpWorkspace()
    await expect(
      runInstall({
        json: false,
        workspaceRoot: ws,
        bundlePath: INVALID_BUNDLE,
        level: "structural",
      }),
    ).rejects.toThrow(/verification failed.*DIGEST_MISMATCH/)
  })

  it("--no-lock skips lock update", async () => {
    const ws = makeTmpWorkspace()
    const result = await runInstall({
      json: false,
      workspaceRoot: ws,
      bundlePath: VALID_BUNDLE,
      noLock: true,
      allowUnauthenticated: true,
    })
    expect(result.lockPath).toBeNull()
    expect(existsSync(join(ws, ".primitivehub/phub.lock"))).toBe(false)
  })
})

/* ─────────────────────────────────────────────────────────────────── */
describe("runInstall — --url + slug@semver via local http fixture", () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    const bundleText = readFileSync(VALID_BUNDLE, "utf8")
    server = createServer((req, res) => {
      // Both shapes return the same bundle.
      if (req.url === "/bundle.json" || req.url?.startsWith("/v1/registry/")) {
        res.writeHead(200, { "Content-Type": "application/vnd.primitivehub.bundle+json" })
        res.end(bundleText)
        return
      }
      if (req.url === "/wrong-content-type") {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<html>not a bundle</html>")
        return
      }
      res.writeHead(404)
      res.end("nope")
    })
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()))
    const { port } = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${port}`
  })

  afterEach(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  it("--url source: fetches + verifies + installs + writes url: attestation", async () => {
    const ws = makeTmpWorkspace()
    const url = `${baseUrl}/bundle.json`
    const result = await runInstall({
      json: false,
      workspaceRoot: ws,
      bundleUrl: url,
      allowUnauthenticated: true,
    })
    expect(result.source.kind).toBe("url")
    expect(result.attestation).toBe(`url:${url}`)
    expect(result.verification.level).toBe("full")
    expect(existsSync(result.installedPath)).toBe(true)
  })

  it("slug@semver source: resolves via <registry>/v1/registry/<slug>/<semver>", async () => {
    const ws = makeTmpWorkspace()
    const result = await runInstall({
      json: false,
      workspaceRoot: ws,
      slugSemver: "minimal-primitive@0.1.0",
      registry: baseUrl,
      allowUnauthenticated: true,
    })
    expect(result.source.kind).toBe("registry")
    expect(result.attestation).toBe("registry:minimal-primitive@0.1.0")
    expect(result.verification.level).toBe("full")
  })

  it("returns FETCH_HTTP_ERROR on 404", async () => {
    const ws = makeTmpWorkspace()
    await expect(
      runInstall({ json: false, workspaceRoot: ws, bundleUrl: `${baseUrl}/no-such-bundle` }),
    ).rejects.toThrow(/HTTP 404/)
  })

  it("returns BUNDLE_PARSE_ERROR on HTML response", async () => {
    const ws = makeTmpWorkspace()
    await expect(
      runInstall({ json: false, workspaceRoot: ws, bundleUrl: `${baseUrl}/wrong-content-type` }),
    ).rejects.toThrow(/not valid JSON/)
  })
})

/* ─────────────────────────────────────────────────────────────────── */
// Tampering with bundle fields (subject.slug, content.mediaType) breaks
// verify's structural step BEFORE the writer's safety rules can run.
// To exercise the writer's defenses, target the writer directly.
describe("install/writer.ts — safety rules (direct)", () => {
  it("planInstallTarget rejects subject.slug containing '..'", async () => {
    const ws = makeTmpWorkspace()
    const { planInstallTarget } = await import("../src/install/writer.js")
    expect(() =>
      planInstallTarget({
        workspaceRoot: ws,
        installRootRel: ".primitivehub/installed/primitives",
        bundle: {
          bundleVersion: "0.1",
          subject: { slug: "../escape", semver: "1.0.0", contentDigest: "sha256:00" },
          content: { bytesB64: "Cg==", mediaType: "text/markdown" },
        },
      }),
    ).toThrow(InstallWriteError)
  })

  it("planInstallTarget rejects an unknown media type", async () => {
    const ws = makeTmpWorkspace()
    const { planInstallTarget } = await import("../src/install/writer.js")
    expect(() =>
      planInstallTarget({
        workspaceRoot: ws,
        installRootRel: ".primitivehub/installed/primitives",
        bundle: {
          bundleVersion: "0.1",
          subject: { slug: "safe-slug", semver: "1.0.0", contentDigest: "sha256:00" },
          content: { bytesB64: "Cg==", mediaType: "application/octet-stream" },
        },
      }),
    ).toThrow(/whitelist|UNKNOWN_MEDIA_TYPE|not in/)
  })
})

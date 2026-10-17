/**
 * Bundle source resolution for `phub install`.
 *
 * Three sources, mutually exclusive:
 *   1. `--bundle <path>`            local file on disk
 *   2. `--url <url>`                fetched via Node's built-in fetch
 *   3. positional `slug@semver`     resolved via `<registry>/v1/registry/<slug>/<semver>`
 *
 * All three return raw bundle JSON text + a stable `BundleSource`
 * tag that the install command writes into the lock's
 * `attestation` field.
 */

import { existsSync, readFileSync } from "node:fs"

export type BundleSource =
  | { kind: "bundle-path"; path: string; attestation: string }
  | { kind: "url"; url: string; attestation: string }
  | { kind: "registry"; slug: string; semver: string; registry: string; attestation: string }

export interface ResolveOptions {
  bundlePath?: string
  bundleUrl?: string
  slugSemver?: string
  registry?: string
  fetchTimeoutMs?: number
}

export class InstallSourceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "InstallSourceError"
  }
}

const DEFAULT_REGISTRY = "https://registry.primitivehub.ai"

/**
 * Split a `slug@semver` positional. Slug grammar in v0.1 is permissive:
 *   - allowed: ASCII letters, digits, `-`, `_`, `.`, `/` (for scoped names)
 *   - forbidden: `..`, leading `/`, `\` (Windows path traversal vector)
 *   - the `@` separator MUST be present and produce a non-empty semver
 */
export function parseSlugSemver(input: string): { slug: string; semver: string } {
  const atIndex = input.lastIndexOf("@")
  if (atIndex <= 0 || atIndex === input.length - 1) {
    throw new InstallSourceError(
      `expected '<slug>@<semver>' (got ${JSON.stringify(input)})`,
      "INVALID_SLUG_SEMVER",
    )
  }
  const slug = input.slice(0, atIndex)
  const semver = input.slice(atIndex + 1)
  validateSlug(slug)
  validateSemver(semver)
  return { slug, semver }
}

function validateSlug(slug: string): void {
  if (slug.length === 0) {
    throw new InstallSourceError("empty slug", "INVALID_SLUG")
  }
  if (slug.includes("..")) {
    throw new InstallSourceError(`slug contains '..' (path traversal): ${slug}`, "UNSAFE_SLUG")
  }
  if (slug.startsWith("/") || slug.startsWith("\\")) {
    throw new InstallSourceError(`slug must not be absolute: ${slug}`, "UNSAFE_SLUG")
  }
  if (!/^[a-zA-Z0-9_./@-]+$/.test(slug)) {
    throw new InstallSourceError(
      `slug contains disallowed characters: ${slug}`,
      "INVALID_SLUG",
    )
  }
}

function validateSemver(semver: string): void {
  // Permissive v0.1: a non-empty string with no path-traversal characters.
  // Tight semver validation is the registry's job at lookup time.
  if (semver.length === 0) {
    throw new InstallSourceError("empty semver", "INVALID_SEMVER")
  }
  if (semver.includes("/") || semver.includes("\\") || semver.includes("..")) {
    throw new InstallSourceError(
      `semver contains disallowed characters: ${semver}`,
      "INVALID_SEMVER",
    )
  }
}

/** Identify which source the options describe; throw if ambiguous. */
export function classifySource(opts: ResolveOptions): BundleSource {
  const provided = [
    opts.bundlePath !== undefined,
    opts.bundleUrl !== undefined,
    opts.slugSemver !== undefined,
  ].filter(Boolean).length
  if (provided === 0) {
    throw new InstallSourceError(
      "no source specified — pass <slug@semver>, --bundle <path>, or --url <url>",
      "NO_SOURCE",
    )
  }
  if (provided > 1) {
    throw new InstallSourceError(
      "mutually exclusive sources — pick one of <slug@semver>, --bundle, --url",
      "AMBIGUOUS_SOURCE",
    )
  }
  if (opts.bundlePath !== undefined) {
    return {
      kind: "bundle-path",
      path: opts.bundlePath,
      attestation: `local:${opts.bundlePath}`,
    }
  }
  if (opts.bundleUrl !== undefined) {
    return { kind: "url", url: opts.bundleUrl, attestation: `url:${opts.bundleUrl}` }
  }
  const { slug, semver } = parseSlugSemver(opts.slugSemver!)
  const registry = (opts.registry ?? DEFAULT_REGISTRY).replace(/\/+$/, "")
  return {
    kind: "registry",
    slug,
    semver,
    registry,
    attestation: `registry:${slug}@${semver}`,
  }
}

/**
 * Acquire raw bundle JSON for the source. Returns the text; caller
 * parses + verifies.
 */
export async function fetchBundleText(
  source: BundleSource,
  opts: { fetchTimeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.fetchTimeoutMs ?? 10_000

  switch (source.kind) {
    case "bundle-path": {
      if (!existsSync(source.path)) {
        throw new InstallSourceError(
          `bundle file not found: ${source.path}`,
          "BUNDLE_NOT_FOUND",
        )
      }
      try {
        return readFileSync(source.path, "utf8")
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new InstallSourceError(
          `failed to read bundle: ${msg}`,
          "BUNDLE_READ_FAILED",
        )
      }
    }

    case "url":
      return await fetchWithTimeout(source.url, timeoutMs)

    case "registry": {
      const url = `${source.registry}/v1/registry/${encodeURIComponent(source.slug)}/${encodeURIComponent(source.semver)}`
      return await fetchWithTimeout(url, timeoutMs)
    }
  }
}

/** Hard cap on a fetched bundle body — matches the writer's 16 MB content cap. */
const MAX_FETCH_BYTES = 16 * 1024 * 1024

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // SECURITY (PH-20261017-05): keep the abort timer live through the ENTIRE
  // response — headers AND body. Previously clearTimeout fired right after
  // headers, so a server that sent 200 then stalled the body hung the install
  // indefinitely. The timer is cleared only in the finally after the body is
  // fully read (or aborted). Body bytes are capped while streaming so an
  // endless/huge body can't exhaust memory even within the timeout window.
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.primitivehub.bundle+json, application/json" },
    })
    if (!response.ok) {
      throw new InstallSourceError(
        `fetch ${url} returned HTTP ${response.status} ${response.statusText}`,
        "FETCH_HTTP_ERROR",
      )
    }
    return await readBodyCapped(response, controller)
  } catch (err) {
    if (err instanceof InstallSourceError) throw err
    const msg = err instanceof Error ? err.message : String(err)
    if (controller.signal.aborted || msg.includes("aborted") || msg.includes("abort")) {
      throw new InstallSourceError(
        `fetch ${url} timed out after ${timeoutMs}ms (headers or body)`,
        "FETCH_TIMEOUT",
      )
    }
    throw new InstallSourceError(`fetch ${url} failed: ${msg}`, "FETCH_FAILED")
  } finally {
    clearTimeout(timer)
  }
}

/** Read the response body under the caller's abort signal, capping total bytes. */
async function readBodyCapped(response: Response, controller: AbortController): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return await response.text() // no stream available — fall back
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > MAX_FETCH_BYTES) {
      controller.abort()
      throw new InstallSourceError(
        `bundle body exceeds the ${MAX_FETCH_BYTES}-byte cap (possible resource-exhaustion source)`,
        "FETCH_BODY_TOO_LARGE",
      )
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}

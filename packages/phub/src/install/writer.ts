/**
 * Bundle content extraction + on-disk write for `phub install`.
 *
 * Safety rules:
 *   - Computed install path MUST stay inside the install root.
 *   - Bundle subject.slug + subject.semver are used as path
 *     components AFTER passing through the same validators as the
 *     CLI source resolver (no '..', no leading '/', no '\').
 *   - File extension comes from a small whitelist derived from
 *     `content.mediaType`. Unknown media types refuse to write.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"

export class InstallWriteError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = "InstallWriteError"
  }
}

/** Minimal shape we read from a parsed bundle. */
export interface BundleHeader {
  bundleVersion: string
  subject: { slug: string; semver: string; contentDigest: string }
  content: { bytesB64: string; mediaType: string; sizeBytes?: number }
}

/** Path components of the place we'll install the bundle's content. */
export interface InstallTarget {
  /** Absolute path of the directory the file lives in. */
  installDir: string
  /** Absolute path of the file itself. */
  installPath: string
  /** Path RELATIVE to the workspace root (used in the lock entry). */
  workspaceRelativePath: string
}

/** Media types we know how to extension-route in v0.1. */
const MEDIA_TYPE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ["text/markdown", "md"],
  ["text/markdown; charset=utf-8", "md"],
  ["text/plain", "txt"],
  ["text/plain; charset=utf-8", "txt"],
  ["application/json", "json"],
])

const MAX_BYTES = 16 * 1024 * 1024 // 16 MB hard cap for v0.1

/**
 * Resolve where the bundle's content will land on disk.
 *
 * Default layout: <workspaceRoot>/<installRootRel>/<slug>/<semver>/primitive.<ext>
 * Where `installRootRel` defaults to `.primitivehub/installed`.
 */
export function planInstallTarget(opts: {
  workspaceRoot: string
  installRootRel: string
  bundle: BundleHeader
}): InstallTarget {
  const workspaceRoot = resolve(opts.workspaceRoot)
  const installRoot = resolve(workspaceRoot, opts.installRootRel)

  // Defensive: the slug + semver were already validated by parseSlugSemver
  // (in source.ts) when arriving through the slug@semver CLI path. When
  // arriving through --bundle / --url we trust the bundle's own subject;
  // re-validate here.
  validateComponent(opts.bundle.subject.slug, "subject.slug")
  validateComponent(opts.bundle.subject.semver, "subject.semver")

  const ext = extensionFor(opts.bundle.content.mediaType)

  // `slug` may legitimately contain `/` (e.g. scoped names like
  // `@primitivehub/secure-code-review`). Treat it as a path fragment and
  // collapse the leading `@` into a literal directory.
  const slugPath = opts.bundle.subject.slug.replace(/^@/, "_at_")
  const installDir = resolve(installRoot, slugPath, opts.bundle.subject.semver)
  const installPath = resolve(installDir, `primitive.${ext}`)

  ensureInsideRoot(installPath, installRoot, "install path escapes install root")
  ensureInsideRoot(installPath, workspaceRoot, "install path escapes workspace root")

  return {
    installDir,
    installPath,
    workspaceRelativePath: relative(workspaceRoot, installPath).replace(/\\/g, "/"),
  }
}

/** Decode the bundle content and write it to the planned install path. */
export function writeBundleContent(
  bundle: BundleHeader,
  target: InstallTarget,
  opts: { overwrite: boolean } = { overwrite: false },
): { bytesWritten: number } {
  if (bundle.content.bytesB64.length === 0) {
    throw new InstallWriteError("bundle content is empty", "EMPTY_CONTENT")
  }

  const decoded = Buffer.from(bundle.content.bytesB64, "base64")
  if (decoded.length === 0) {
    throw new InstallWriteError("base64 decoded to zero bytes", "DECODE_FAILED")
  }
  if (decoded.length > MAX_BYTES) {
    throw new InstallWriteError(
      `bundle content (${decoded.length} bytes) exceeds the v0.1 size cap of ${MAX_BYTES}`,
      "CONTENT_TOO_LARGE",
    )
  }
  if (bundle.content.sizeBytes !== undefined && bundle.content.sizeBytes !== decoded.length) {
    throw new InstallWriteError(
      `bundle content.sizeBytes (${bundle.content.sizeBytes}) does not match decoded length (${decoded.length})`,
      "SIZE_MISMATCH",
    )
  }

  if (!opts.overwrite && existsSync(target.installPath)) {
    throw new InstallWriteError(
      `install path already exists: ${target.installPath} (use --force to overwrite)`,
      "ALREADY_INSTALLED",
    )
  }

  mkdirSync(dirname(target.installPath), { recursive: true })
  writeFileSync(target.installPath, decoded)
  return { bytesWritten: decoded.length }
}

function validateComponent(value: string, label: string): void {
  if (value.length === 0) {
    throw new InstallWriteError(`empty ${label}`, "EMPTY_COMPONENT")
  }
  if (value.includes("..")) {
    throw new InstallWriteError(
      `${label} contains '..': ${value}`,
      "UNSAFE_COMPONENT",
    )
  }
  if (isAbsolute(value)) {
    throw new InstallWriteError(`${label} must not be absolute: ${value}`, "UNSAFE_COMPONENT")
  }
  if (value.includes("\\")) {
    throw new InstallWriteError(
      `${label} contains backslash: ${value}`,
      "UNSAFE_COMPONENT",
    )
  }
}

function extensionFor(mediaType: string): string {
  const normalized = mediaType.toLowerCase().trim()
  const ext = MEDIA_TYPE_EXTENSIONS.get(normalized)
  if (ext !== undefined) return ext
  // Try the parameter-stripped form ('text/markdown; charset=utf-8' → 'text/markdown')
  const semi = normalized.indexOf(";")
  if (semi !== -1) {
    const ext2 = MEDIA_TYPE_EXTENSIONS.get(normalized.slice(0, semi).trim())
    if (ext2 !== undefined) return ext2
  }
  throw new InstallWriteError(
    `media type ${JSON.stringify(mediaType)} is not in the v0.1 extension-route whitelist`,
    "UNKNOWN_MEDIA_TYPE",
  )
}

function ensureInsideRoot(absPath: string, root: string, message: string): void {
  const rel = relative(root, absPath)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new InstallWriteError(`${message}: ${absPath}`, "PATH_TRAVERSAL")
  }
}

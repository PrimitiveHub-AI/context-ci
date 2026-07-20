/**
 * `phub install` — safe installer for context primitives.
 *
 * Replaces the T5 attack class (`curl|bash`, `npx <evil>`, `pip
 * install <url>`) with verified install:
 *
 *   phub install @scope/skill-x@1.2.3
 *   phub install --bundle ./bundle.json
 *   phub install --url https://example.com/bundle.json
 *
 * Pipeline:
 *   1. Classify source (path / URL / slug@semver).
 *   2. Fetch bundle JSON text.
 *   3. Parse + verify (uses @primitivehub/verify; default level=policy).
 *   4. Extract bundle.content.bytesB64 to disk under
 *      <workspace>/.primitivehub/installed/<slug>/<semver>/primitive.<ext>.
 *   5. Update .primitivehub/phub.lock with the installed artifact +
 *      attestation: <local|url|registry>:<details>.
 *
 * Failure modes are loud and structured. Every refusal carries a
 * stable code (e.g. INVALID_SLUG_SEMVER, BUNDLE_REJECTED,
 * ALREADY_INSTALLED) so CI tools can branch on the code.
 */

import { existsSync, readFileSync, mkdirSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"

import { verifyBundle, type VerificationLevel, type VerificationResult } from "@primitivehub/verify"

import {
  writeLock,
  type PhubLock,
  parseLock,
  type LockedArtifact,
  type LockAttestation,
} from "../audit/lock.js"
import {
  classifySource,
  fetchBundleText,
  InstallSourceError,
  type BundleSource,
} from "../install/source.js"
import {
  planInstallTarget,
  writeBundleContent,
  InstallWriteError,
  type BundleHeader,
} from "../install/writer.js"

export interface InstallOptions {
  json: boolean
  workspaceRoot?: string
  // Source: exactly one of these.
  bundlePath?: string
  bundleUrl?: string
  slugSemver?: string
  registry?: string
  fetchTimeoutMs?: number
  // Layout.
  installRootRel?: string
  // Lock.
  lockPath?: string
  noLock?: boolean
  // Behavior.
  force?: boolean
  level?: VerificationLevel
}

export interface InstallResult {
  source: BundleSource
  bundle: { subject: { slug: string; semver: string; contentDigest: string } }
  installedPath: string
  workspaceRelativePath: string
  bytesWritten: number
  verification: VerificationResult
  lockPath: string | null
  attestation: string
  exitCode: 0 | 1 | 2
}

// .primitivehub/installed/primitives/ — the "primitives" segment makes
// installed artifacts match the existing classifier rule (**/primitives/**)
// so re-audit discovers and policy-checks them. See ADR-0028 § "Path layout".
const DEFAULT_INSTALL_ROOT_REL = ".primitivehub/installed/primitives"
const DEFAULT_LOCK_REL = ".primitivehub/phub.lock"

/** Top-level dispatch for `phub install`. Returns process exit code. */
export async function installCommand(opts: InstallOptions): Promise<number> {
  const workspaceRoot = resolve(opts.workspaceRoot ?? process.cwd())
  if (!existsSync(workspaceRoot)) {
    process.stderr.write(`phub install: workspace root not found: ${workspaceRoot}\n`)
    return 2
  }

  let result: InstallResult
  try {
    result = await runInstall({ ...opts, workspaceRoot })
  } catch (err) {
    if (err instanceof InstallSourceError) {
      process.stderr.write(`phub install: [${err.code}] ${err.message}\n`)
      return 2
    }
    if (err instanceof InstallWriteError) {
      process.stderr.write(`phub install: [${err.code}] ${err.message}\n`)
      return err.code === "ALREADY_INSTALLED" ? 1 : 2
    }
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`phub install: ${msg}\n`)
    return 2
  }

  emit(result, opts.json ?? false)
  return result.exitCode
}

/** Programmatic entry. Throws InstallSourceError / InstallWriteError on refusal paths. */
export async function runInstall(
  opts: InstallOptions & { workspaceRoot: string },
): Promise<InstallResult> {
  // 1. Resolve source. Build the options object conditionally because
  //    exactOptionalPropertyTypes refuses 'undefined' values.
  const sourceOpts: Parameters<typeof classifySource>[0] = {}
  if (opts.bundlePath !== undefined) sourceOpts.bundlePath = opts.bundlePath
  if (opts.bundleUrl !== undefined) sourceOpts.bundleUrl = opts.bundleUrl
  if (opts.slugSemver !== undefined) sourceOpts.slugSemver = opts.slugSemver
  if (opts.registry !== undefined) sourceOpts.registry = opts.registry
  if (opts.fetchTimeoutMs !== undefined) sourceOpts.fetchTimeoutMs = opts.fetchTimeoutMs
  const source = classifySource(sourceOpts)

  // 2. Fetch bundle text.
  const fetchOpts: { fetchTimeoutMs?: number } = {}
  if (opts.fetchTimeoutMs !== undefined) fetchOpts.fetchTimeoutMs = opts.fetchTimeoutMs
  const bundleText = await fetchBundleText(source, fetchOpts)

  // 3. Parse + verify.
  let bundle: BundleHeader
  try {
    bundle = JSON.parse(bundleText) as BundleHeader
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new InstallSourceError(`bundle is not valid JSON: ${msg}`, "BUNDLE_PARSE_ERROR")
  }

  const level: VerificationLevel = opts.level ?? "policy"
  const verification = await verifyBundle(bundle as unknown as Parameters<typeof verifyBundle>[0], {
    level,
  })
  if (!verification.valid) {
    // Build a structured failure that includes the verify codes.
    const codes = verification.failures.map((f) => f.code).join(", ")
    throw new InstallSourceError(
      `bundle verification failed at level=${level}: ${codes}`,
      "BUNDLE_REJECTED",
    )
  }

  // 4. Plan + write.
  const target = planInstallTarget({
    workspaceRoot: opts.workspaceRoot,
    installRootRel: opts.installRootRel ?? DEFAULT_INSTALL_ROOT_REL,
    bundle,
  })
  const { bytesWritten } = writeBundleContent(bundle, target, {
    overwrite: opts.force ?? false,
  })

  // 5. Lock update (optional).
  let updatedLockPath: string | null = null
  if (opts.noLock !== true) {
    const updateOpts: Parameters<typeof updateLock>[0] = {
      workspaceRoot: opts.workspaceRoot,
      relativePath: target.workspaceRelativePath,
      contentDigest: bundle.subject.contentDigest,
      attestation: source.attestation,
    }
    if (opts.lockPath !== undefined) updateOpts.lockPathOverride = opts.lockPath
    updatedLockPath = updateLock(updateOpts)
  }

  return {
    source,
    bundle: { subject: bundle.subject },
    installedPath: target.installPath,
    workspaceRelativePath: target.workspaceRelativePath,
    bytesWritten,
    verification,
    lockPath: updatedLockPath,
    attestation: source.attestation,
    exitCode: 0,
  }
}

/** Add or update an entry in the project's lock file. Creates a v0.1 lock if absent. */
function updateLock(args: {
  workspaceRoot: string
  lockPathOverride?: string
  relativePath: string
  contentDigest: string
  attestation: string
}): string {
  const lockPath = args.lockPathOverride
    ? isAbsolute(args.lockPathOverride)
      ? args.lockPathOverride
      : resolve(args.workspaceRoot, args.lockPathOverride)
    : join(args.workspaceRoot, DEFAULT_LOCK_REL)

  // Read or seed the lock.
  let lock: PhubLock
  if (existsSync(lockPath)) {
    try {
      const raw = readFileSync(lockPath, "utf8")
      lock = parseLock(raw, lockPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new InstallWriteError(`cannot read existing lock: ${msg}`, "LOCK_READ_FAILED")
    }
  } else {
    lock = {
      $schema: "https://primitivehub.ai/phub-lock/v0.1.json",
      version: "0.1",
      generator: "phub@0.1.0",
      root: args.workspaceRoot,
      top10_version: "0.1",
      artifacts: [],
    }
  }

  // Replace OR append the entry. Path is the key.
  const newEntry: LockedArtifact = {
    path: args.relativePath,
    classification: "primitive",
    digest: args.contentDigest.startsWith("sha256:") ? args.contentDigest : `sha256:${args.contentDigest}`,
    attestation: args.attestation as LockAttestation,
  }
  const existingIndex = lock.artifacts.findIndex((a) => a.path === args.relativePath)
  if (existingIndex >= 0) {
    lock.artifacts[existingIndex] = newEntry
  } else {
    lock.artifacts.push(newEntry)
  }

  mkdirSync(dirname(lockPath), { recursive: true })
  writeLock(lockPath, lock)
  return lockPath
}

function emit(result: InstallResult, asJson: boolean): void {
  if (asJson) {
    process.stdout.write(
      JSON.stringify(
        {
          source: result.source.kind,
          attestation: result.attestation,
          subject: result.bundle.subject,
          installedPath: result.installedPath,
          workspaceRelativePath: result.workspaceRelativePath,
          bytesWritten: result.bytesWritten,
          lockPath: result.lockPath,
          verification: { valid: result.verification.valid, level: result.verification.level },
        },
        null,
        2,
      ) + "\n",
    )
    return
  }
  process.stdout.write(
    `[install] source=${result.source.kind} attestation=${result.attestation}\n` +
      `[install] subject=${result.bundle.subject.slug}@${result.bundle.subject.semver}\n` +
      `[install] verified at level=${result.verification.level}\n` +
      `[install] wrote ${result.bytesWritten} bytes → ${result.workspaceRelativePath}\n` +
      (result.lockPath !== null
        ? `[install] lock updated: ${result.lockPath}\n`
        : `[install] lock skipped (--no-lock)\n`),
  )
}

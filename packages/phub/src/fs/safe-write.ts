/**
 * Symlink-safe file writing — the SINGLE writer every phub state-file writer
 * must use (lock, install, init).
 *
 * SECURITY (CWE-59/61/367): a repository can ship a file as a symbolic link
 * (git stores symlinks as mode 120000, and a relative target survives cloning).
 * A plain `writeFileSync` follows that link, so a committed `.primitivehub/
 * phub.lock`, install-target, or `AGENTS.md` symlink redirects the write to any
 * path the victim can write — clobbering `~/.ssh/authorized_keys`, shell rc
 * files, CI config, etc. The earlier R06/PH-02 fix hardened ONLY the
 * installer's non-force path and used `existsSync`, which reports `false` for a
 * DANGLING symlink — so a dangling final-component symlink (and the `--force`
 * overwrite path, and `writeLock`/`init` entirely) stayed exploitable. This
 * module makes the guarantee uniform and `lstat`-based.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, isAbsolute, relative, resolve } from "node:path"

export class UnsafeWriteError extends Error {
  constructor(
    message: string,
    readonly code: "WRITE_SYMLINK" | "WRITE_EXISTS" | "PATH_TRAVERSAL",
  ) {
    super(message)
    this.name = "UnsafeWriteError"
  }
}

/**
 * Realpath of the deepest EXISTING ancestor of `p`, rejoined with the
 * not-yet-existing tail. `realpathSync` is only ever called on a path confirmed
 * to exist (worst case the filesystem root). Used for ANCESTOR containment; the
 * final component is guarded separately by `lstat` (dangling-symlink-safe).
 */
export function realpathOfExisting(p: string): string {
  let cur = resolve(p)
  const tail: string[] = []
  while (!existsSync(cur)) {
    tail.unshift(basename(cur))
    const parent = dirname(cur)
    if (parent === cur) break // reached filesystem root
    cur = parent
  }
  return tail.length > 0 ? resolve(realpathSync(cur), ...tail) : realpathSync(cur)
}

/** Symlink-aware containment: `absPath` must resolve under `root`. */
export function ensureRealpathInsideRoot(absPath: string, root: string, message: string): void {
  const realTarget = realpathOfExisting(absPath)
  const realRoot = realpathOfExisting(root)
  const rel = relative(realRoot, realTarget)
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new UnsafeWriteError(
      `${message} via symlink: ${absPath} resolves to ${realTarget}`,
      "PATH_TRAVERSAL",
    )
  }
}

export interface SafeWriteOptions {
  /** Allow replacing an existing REGULAR file (never a symlink). Default false. */
  overwrite?: boolean
  /** If set, the resolved path must stay under this root (ancestor-symlink guard). */
  root?: string
}

/**
 * Write a file WITHOUT following a symlink at the final path component.
 *
 * Guarantees:
 *  1. Refuses if the final component is a symlink — `lstat` does NOT follow, so
 *     a dangling symlink is detected too (the `existsSync` gap in 0.1.6).
 *  2. Optional realpath containment under `root` — a symlinked ancestor cannot
 *     redirect the write outside the workspace.
 *  3. `O_EXCL` create (`flag: "wx"`) — never truncates through a symlink and
 *     fails if anything appeared since the `lstat`, closing the TOCTOU window.
 *     Overwrite mode unlinks the confirmed-regular file first, then `O_EXCL`.
 */
export function writeFileNoFollow(
  path: string,
  data: string | Uint8Array,
  opts: SafeWriteOptions = {},
): void {
  const abs = resolve(path)

  let st: ReturnType<typeof lstatSync> | null = null
  try {
    st = lstatSync(abs)
  } catch {
    st = null // ENOENT — brand-new path
  }
  if (st?.isSymbolicLink()) {
    throw new UnsafeWriteError(`refusing to write through a symlink: ${abs}`, "WRITE_SYMLINK")
  }

  if (opts.root !== undefined) {
    ensureRealpathInsideRoot(abs, resolve(opts.root), "write path escapes root")
  }

  if (st) {
    if (!opts.overwrite) {
      throw new UnsafeWriteError(`path already exists: ${abs}`, "WRITE_EXISTS")
    }
    unlinkSync(abs) // confirmed non-symlink above
  }

  mkdirSync(dirname(abs), { recursive: true })
  // O_CREAT|O_EXCL: refuses an existing target (incl. a symlink re-created in
  // the race) and never follows a link.
  writeFileSync(abs, data, { flag: "wx" })
}

/**
 * "Uncovered surface" detection for `phub audit`.
 *
 * `phub audit` inventories *agent-context artifacts* (see classifier.ts)
 * and runs the Top 10 detector roster over the text-scannable ones. It
 * does NOT review executable code or other non-context files — that is a
 * different threat surface (a code review / SAST job), out of scope for
 * the context-artifact kernel.
 *
 * The danger is silence: before this module, a walked file that didn't
 * classify as a context artifact was dropped with no trace, so a skill
 * shipping `install.sh` / `server.cjs` could audit "1/1 clean" while its
 * actual T5 surface (the scripts) was never looked at. That false comfort
 * bit a real skill-consumption session (2026-06-09, ledger SK-002/SK-004).
 *
 * This module re-surfaces those files as a non-failing WARNING so the
 * operator knows what the audit did NOT cover. It does not scan them and
 * does not change the exit code — it just refuses to let "clean" mean
 * "safe" when un-reviewed executable surface is present.
 *
 * Pure + path-based (no I/O), matching the classifier's discipline. A
 * future ADR may add shebang sniffing for extensionless executables.
 */

/** The kind of uncovered file surfaced to the operator. */
export type UncoveredKind = "executable"

export interface UncoveredFile {
  /** Path relative to the audit root, normalized to forward slashes. */
  path: string
  kind: UncoveredKind
}

/**
 * File extensions that denote executable / script surface phub audit
 * does not review. Lower-cased, leading dot included.
 */
export const EXECUTABLE_EXTS: ReadonlySet<string> = new Set([
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".bat",
  ".cmd",
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".py",
  ".rb",
  ".pl",
  ".php",
  ".lua",
  ".exe",
  ".bin",
])

/**
 * Classify a walked-but-unclassified path as uncovered surface, or null
 * if it's an inert file (markdown, images, text, config we don't flag).
 *
 * Input is a relative path using forward slashes (caller normalizes).
 * Only call this for paths that `classify()` returned null for.
 */
export function classifyUncovered(relPath: string): UncoveredKind | null {
  const norm = relPath.replace(/\\/g, "/")
  const base = norm.split("/").pop() ?? ""
  const dot = base.lastIndexOf(".")
  if (dot <= 0) return null
  const ext = base.slice(dot).toLowerCase()
  if (EXECUTABLE_EXTS.has(ext)) return "executable"
  return null
}

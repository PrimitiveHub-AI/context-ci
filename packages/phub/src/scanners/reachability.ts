/**
 * Reachability / role classifier — RC2 Pass A (foundation only).
 *
 * Answers one question about a scanned file: "would an agent LOAD this as
 * live instruction context, or is it an inert fixture / human-facing doc?"
 *
 * The role is intended to become a CONFIDENCE MULTIPLIER on a finding's
 * score (RC2 Pass B), so the same attack string weighs more in a loaded
 * SKILL.md than in a test fixture — WITHOUT ever whitelisting: INERT is
 * down-weighted, never zeroed, and UNKNOWN fails safe to full scrutiny.
 *
 * As of Pass A this module is PURE, deterministic, and NOT wired into
 * scoring or any detector. It ships with tests so the taxonomy can be
 * reviewed before it moves a single verdict.
 *
 * INSTRUCTION detection reuses the existing artifact classifier
 * (audit/classifier.ts) — the single source of truth for "is this a
 * recognized agent-instruction surface". Lockstep partner:
 * apps/api/scanners/reachability.py (shared test table enforces parity).
 */
import { classify, isTextScannable } from "../audit/classifier.js"

export type ReachRole = "instruction" | "ambient" | "inert" | "unknown"

/**
 * Provisional confidence weights (RC2 Pass B spends these in the scorer).
 * INERT < AMBIENT < INSTRUCTION; UNKNOWN fails safe to 1.0. Never 0 — an
 * inert finding is down-weighted, not suppressed, so an attacker hiding a
 * payload in tests/ still scores. Marked provisional until the corpus
 * calibration in Pass B.
 */
export const REACH_WEIGHT: Record<ReachRole, number> = {
  instruction: 1.0,
  ambient: 0.7,
  inert: 0.4,
  unknown: 1.0,
}

const INERT_SEGMENTS: ReadonlySet<string> = new Set([
  "tests",
  "test",
  "__tests__",
  "spec",
  "specs",
  "fixtures",
  "fixture",
  "bench",
  "benchmarks",
  "examples",
  "example",
  "conformance",
  "__mocks__",
  "testdata",
  "e2e",
])

const AMBIENT_SEGMENTS: ReadonlySet<string> = new Set(["docs", "doc"])
const AMBIENT_EXTS: ReadonlySet<string> = new Set([".md", ".mdx", ".markdown", ".rst", ".txt"])
const AMBIENT_BASENAME_RE = /^(readme|changelog|contributing|history|notice|authors)\b/i

function segmentsOf(relPath: string): string[] {
  return relPath
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s.length > 0)
}

function isInert(relPath: string): boolean {
  const segs = segmentsOf(relPath)
  const base = (segs[segs.length - 1] ?? "").toLowerCase()
  if (base.includes(".test.") || base.includes(".spec.")) return true
  return segs.some((s) => INERT_SEGMENTS.has(s.toLowerCase()))
}

function isAmbient(relPath: string): boolean {
  const segs = segmentsOf(relPath)
  const base = segs[segs.length - 1] ?? ""
  if (!base) return false
  if (AMBIENT_BASENAME_RE.test(base)) return true
  if (segs.some((s) => AMBIENT_SEGMENTS.has(s.toLowerCase()))) return true
  const dot = base.lastIndexOf(".")
  if (dot > 0 && AMBIENT_EXTS.has(base.slice(dot).toLowerCase())) return true
  return false
}

/**
 * Map a repo-relative path (forward slashes; empty for a single-blob paste)
 * to a reachability role. Precedence is fail-safe: a recognized instruction
 * surface wins even under tests/ (over-scrutiny beats under-scrutiny), and
 * anything unrecognized is UNKNOWN (full scrutiny), never silently inert.
 */
export function classifyRole(relPath: string): ReachRole {
  const cls = classify(relPath)
  if (cls !== null && isTextScannable(cls)) return "instruction"
  if (isInert(relPath)) return "inert"
  if (isAmbient(relPath)) return "ambient"
  return "unknown"
}

/** Convenience: the provisional confidence weight for a path's role. */
export function reachWeight(relPath: string): number {
  return REACH_WEIGHT[classifyRole(relPath)]
}

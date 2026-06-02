/**
 * Human-readable reporter for `phub audit`.
 *
 * Output shape:
 *   phub audit <root>
 *
 *   Inventory (N artifacts, K classes):
 *     <class>  <count>  <comma-separated paths or "…">
 *
 *   Findings:
 *     [FAIL] <path> (<class>)
 *       [<cciId>] <detectorName> — <summary>
 *         L<n>  <snippet>
 *               <suggestion>
 *
 *   Skipped: <breakdown by reason>
 *   Result: M of N artifacts flagged. F findings total.
 */

import { type AuditResult } from "../audit/types.js"
import { Severity } from "../scanners/types.js"

const SEVERITY_BADGE: Record<Severity, string> = {
  [Severity.INFO]: "[INFO]",
  [Severity.WARN]: "[WARN]",
  [Severity.FAIL]: "[FAIL]",
}

const INVENTORY_PATH_PREVIEW = 3

function previewPaths(paths: readonly string[]): string {
  if (paths.length <= INVENTORY_PATH_PREVIEW) return paths.join(", ")
  const head = paths.slice(0, INVENTORY_PATH_PREVIEW).join(", ")
  return `${head}, … (+${paths.length - INVENTORY_PATH_PREVIEW} more)`
}

function summarizeSkipped(skipped: AuditResult["skipped"]): string {
  if (skipped.length === 0) return "Skipped: nothing under skip-list."
  const counts: Record<string, number> = {}
  for (const s of skipped) counts[s.reason] = (counts[s.reason] ?? 0) + 1
  const parts: string[] = []
  if (counts["skip-list"]) parts.push(`${counts["skip-list"]} skip-list dirs`)
  if (counts["hidden-dir"]) parts.push(`${counts["hidden-dir"]} hidden dirs`)
  if (counts["symlink"]) parts.push(`${counts["symlink"]} symlinks`)
  if (counts["depth"]) parts.push(`${counts["depth"]} depth-bounded`)
  if (counts["limit"]) parts.push(`${counts["limit"]} over file-limit`)
  return `Skipped: ${parts.join(", ")}.`
}

function shortDigest(digest: string): string {
  const hex = digest.startsWith("sha256:") ? digest.slice("sha256:".length) : digest
  return `sha256:${hex.slice(0, 12)}…`
}

function renderDriftSection(result: AuditResult): string[] {
  const out: string[] = []
  const ls = result.lockState
  if (!ls || ls.mode === "off") return out
  if (ls.mode === "update") {
    out.push(`Wrote lock: ${ls.lockPath}`)
    out.push("")
    return out
  }
  // mode === "check"
  if (!ls.drift) return out
  const { added, removed, modified, reclassified } = ls.drift
  if (!ls.hasDrift) {
    out.push(`Lock match: ${ls.lockPath} (no drift).`)
    out.push("")
    return out
  }
  out.push(`Drift detected against ${ls.lockPath}:`)
  out.push("")
  if (added.length > 0) {
    out.push(`  Added (${added.length}):`)
    for (const a of added) {
      out.push(`    ${a.path}   (${a.classification}, ${shortDigest(a.digest)})`)
    }
  }
  if (modified.length > 0) {
    out.push(`  Modified (${modified.length}):`)
    for (const m of modified) {
      out.push(`    ${m.path}   ${shortDigest(m.fromDigest)} → ${shortDigest(m.toDigest)}`)
    }
  }
  if (removed.length > 0) {
    out.push(`  Removed (${removed.length}):`)
    for (const r of removed) {
      out.push(`    ${r.path}   (${r.classification}, ${shortDigest(r.digest)})`)
    }
  }
  if (reclassified.length > 0) {
    out.push(`  Reclassified (${reclassified.length}):`)
    for (const r of reclassified) {
      out.push(`    ${r.path}   ${r.fromClass} → ${r.toClass}`)
    }
  }
  out.push("")
  out.push("Resolution:")
  out.push("  - If these changes are intentional, run `phub audit --update-lock`")
  out.push("    and commit the regenerated .primitivehub/phub.lock.")
  out.push("  - If a change is unexpected, investigate the source before re-locking.")
  out.push("")
  return out
}

export function renderAuditHumanReport(result: AuditResult): string {
  const out: string[] = []
  out.push(`phub audit ${result.root}`)
  out.push("")

  // Inventory grouped by classification.
  const classes = Object.keys(result.summary.byClassification).sort()
  if (result.artifacts.length === 0) {
    out.push("Inventory: no agent-context artifacts found.")
  } else {
    out.push(`Inventory (${result.summary.totalArtifacts} artifacts, ${classes.length} classes):`)
    for (const cls of classes) {
      const paths = result.artifacts.filter((a) => a.classification === cls).map((a) => a.path)
      const note = result.artifacts.some((a) => a.classification === cls && !a.scanned)
        ? "  (classified, not scanned in v0.1)"
        : ""
      out.push(`  ${cls.padEnd(20)} ${String(paths.length).padStart(3)}  ${previewPaths(paths)}${note}`)
    }
    out.push("")
  }

  // Findings — only flagged artifacts.
  const flagged = result.artifacts.filter((a) => a.flagged)
  if (flagged.length > 0) {
    out.push("Findings:")
    for (const a of flagged) {
      out.push(`  [FAIL] ${a.path} (${a.classification})`)
      for (const adj of a.adjustedVerdicts) {
        const v = adj.verdict
        if (v.severity === Severity.INFO) continue
        if (adj.suppressedByOff) continue
        out.push(`    ${SEVERITY_BADGE[v.severity]} ${v.detectorName} (${v.cciId}) — ${v.summary}`)
        for (const h of v.diffHints) {
          out.push(`      L${h.line}  ${h.snippet}`)
          out.push(`             ${h.suggestion}`)
        }
      }
      out.push("")
    }
  }

  if (result.truncated) {
    out.push(`WARN: file-limit reached; results truncated. Re-run with --max-files=<n> to expand.`)
  }
  out.push(summarizeSkipped(result.skipped))
  out.push("")

  // Lock-section appears below the inventory + findings, before the
  // final "Result" line.
  out.push(...renderDriftSection(result))

  const s = result.summary
  const driftFailure = result.lockState?.mode === "check" && result.lockState.hasDrift
  if (s.flaggedArtifacts === 0 && !driftFailure) {
    out.push(`Result: ${s.totalArtifacts}/${s.totalArtifacts} artifacts clean.`)
  } else {
    const parts: string[] = []
    if (s.flaggedArtifacts > 0) {
      parts.push(
        `${s.flaggedArtifacts} of ${s.totalArtifacts} artifacts flagged (${s.totalFindings} finding${s.totalFindings === 1 ? "" : "s"})`,
      )
    }
    if (driftFailure) parts.push(`drift detected against ${result.lockState?.lockPath ?? "lockfile"}`)
    out.push(`Result: ${parts.join("; ")}. Review before committing.`)
  }
  return out.join("\n")
}

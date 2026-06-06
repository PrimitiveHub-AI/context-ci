"use client"

/**
 * /check verdict reporter — the FP / FN submission portal surface.
 *
 * ADR-0030 § 3 names the AV-vendor product-family slots; the "FP
 * submission portal" + "FN submission portal" rows live here. A user
 * who disagrees with a /check verdict (legitimate primitive flagged
 * OR adversarial primitive let through) clicks one of two buttons;
 * the browser opens GitHub's new-issue UI pre-filled with the input,
 * the verdict snapshot, and the four-path triage template from
 * `docs/false-{positive,negative}-resolution.md` § 1.
 *
 * Client-side only: no server-side state, no auth complications.
 * Server-side ingestion can follow in a later round if volume
 * justifies it; for v0.1 the GitHub UI prefill is sufficient.
 */

import { ExternalLink, Flag, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { CheckResponse } from "@/lib/check/types"

const GITHUB_NEW_ISSUE_BASE =
  "https://github.com/DevXYZx/primitivehub/issues/new"

// GitHub's URL-prefill body field tolerates ~6-7 KB; truncate the
// echoed input to be safe across all client browsers.
const INPUT_ECHO_MAX_CHARS = 2000

function truncateForUrl(s: string, max: number = INPUT_ECHO_MAX_CHARS): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n\n... (truncated; full content was ${s.length} chars pasted at /check)`
}

interface ReportVerdictProps {
  result: CheckResponse
  pastedInput: string
}

function buildReportBody(opts: {
  kind: "fp" | "fn"
  result: CheckResponse
  pastedInput: string
}): string {
  const { kind, result, pastedInput } = opts
  const triggeredVerdicts = result.verdicts.filter((v) => !v.passed)
  const passedVerdicts = result.verdicts.filter((v) => v.passed)
  const verdictBand = result.summary.verdictBand
  const trustScore = result.summary.trustScore

  const triggeredList = triggeredVerdicts.length
    ? triggeredVerdicts
        .map(
          (v) =>
            `- **${v.cciId}** \`${v.detectorName}\` v${v.detectorVersion} — ${v.severity.toUpperCase()} — ${v.summary}`,
        )
        .join("\n")
    : "_(no detectors triggered)_"

  const passedList = passedVerdicts.length
    ? passedVerdicts
        .map(
          (v) => `- ${v.cciId} \`${v.detectorName}\` v${v.detectorVersion} — PASS`,
        )
        .join("\n")
    : "_(all detectors triggered)_"

  const header =
    kind === "fp"
      ? `## False positive submission

\`/check\` flagged this content but I believe it should pass. Per the four-path methodology in [\`docs/false-positive-resolution.md\`](https://github.com/DevXYZx/primitivehub/blob/main/docs/false-positive-resolution.md) § 1, I propose this report be triaged.`
      : `## False negative submission

\`/check\` passed this content but I believe it contains an attack. Per the four-path methodology in [\`docs/false-negative-resolution.md\`](https://github.com/DevXYZx/primitivehub/blob/main/docs/false-negative-resolution.md) § 1, I propose this report be triaged.`

  const triagePrompt =
    kind === "fp"
      ? `## Proposed triage path (mark one)

- [ ] **Path A** — edit the content (the primitive author rewrites the prose so it doesn't fire).
- [ ] **Path B** — narrow allow entry + FP-NNN ledger record (policy carve-out).
- [ ] **Path C** — detector ratchet (lockstep TS + Py with corpus measurement).
- [ ] **Path D** — escalate to security reviewer.

(Leave unchecked if you'd like the maintainers to classify.)`
      : `## Proposed triage path (mark one)

- [ ] **Path A** — corpus relabel (the sample isn't actually adversarial).
- [ ] **Path B** — narrow allow entry + FN-NNN ledger record (rare case).
- [ ] **Path C** — detector ratchet (add a new pattern or check).
- [ ] **Path D** — spec gap (a new CCI category is needed).

(Leave unchecked if you'd like the maintainers to classify.)`

  return [
    header,
    "",
    `### Verdict snapshot`,
    "",
    `- **Request ID:** \`${result.requestId}\``,
    `- **Mode:** \`${result.mode}\``,
    `- **Target:** \`${result.target.displayName}\``,
    `- **Trust score:** ${trustScore} / 100  (band: **${verdictBand}**)`,
    `- **Detectors:** ${result.summary.detectorsTriggered} / ${result.summary.detectorsRun} triggered`,
    `- **Counts:** ${result.summary.failCount} fail, ${result.summary.warnCount} warn, ${result.summary.infoCount} clean`,
    "",
    `### Detectors that ${kind === "fp" ? "fired (the dispute)" : "passed (the candidates for ratchet)"}`,
    "",
    kind === "fp" ? triggeredList : passedList,
    "",
    kind === "fp" ? "" : `### Detectors that already fired (already covered)\n\n${triggeredList}\n`,
    "### Input echo (truncated for URL prefill)",
    "",
    "```markdown",
    truncateForUrl(pastedInput),
    "```",
    "",
    triagePrompt,
    "",
    "### Reporter notes",
    "",
    "<!-- Why do you believe this verdict is wrong? Any incident reference, context, or fix suggestion goes here. -->",
    "",
    "---",
    `_Auto-generated by [\`/check\`](https://primitivehub.ai/check) reporter v0.1. Filed against the public corpus at \`bench/corpus/manifest.yaml\`._`,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

function buildReportUrl(opts: {
  kind: "fp" | "fn"
  result: CheckResponse
  pastedInput: string
}): string {
  const { kind, result } = opts
  const labels = kind === "fp" ? "fp-submission,needs-classification" : "fn-submission,needs-classification"
  const target = result.target.displayName.slice(0, 60)
  const title =
    kind === "fp"
      ? `FP: /check flagged "${target}" — request triage`
      : `FN: /check passed "${target}" — request triage`
  const body = buildReportBody(opts)
  const params = new URLSearchParams({ title, body, labels })
  return `${GITHUB_NEW_ISSUE_BASE}?${params.toString()}`
}

export function ReportVerdict({ result, pastedInput }: ReportVerdictProps) {
  const anyTriggered = result.summary.detectorsTriggered > 0
  // FP only makes sense when at least one detector triggered.
  // FN only makes sense when at least one detector did NOT trigger
  // (which is always true at our 10-detector pool, but the framing
  // is "you think we missed an attack" so we anchor on the band).
  const offerFp = anyTriggered
  const offerFn = !anyTriggered || result.summary.verdictBand === "clean"

  if (!offerFp && !offerFn) return null

  return (
    <Card className="border-border/40 bg-card/50 p-4">
      <div className="flex items-start gap-3">
        <Flag className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">
            Disagree with this verdict?
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            File a numbered ledger entry against the public corpus. We triage
            per the four-path methodology and credit reporters in the closure
            log.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {offerFp && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <a
                  href={buildReportUrl({ kind: "fp", result, pastedInput })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Shield className="size-3.5" />
                  Report false positive
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            )}
            {offerFn && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <a
                  href={buildReportUrl({ kind: "fn", result, pastedInput })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Flag className="size-3.5" />
                  Report missed attack
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            )}
          </div>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            opens github · no account required to draft · public ledger entry
          </p>
        </div>
      </div>
    </Card>
  )
}

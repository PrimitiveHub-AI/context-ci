"use client"

/**
 * Verdict result panel for /check.
 *
 * Renders four states in a single component:
 *   - idle:      "paste something to start" empty state
 *   - loading:   spinner + a beat of running-detector text
 *   - error:     named-code panel with the server's error message
 *   - result:    trust score + per-detector breakdown
 *
 * The component owns no state; the page passes one of (result, error,
 * isLoading) and we render accordingly. Keeps the layout shift
 * predictable across paste → submit → verdict.
 */
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Github,
  Info,
  Package,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type {
  CheckFile,
  CheckResponse,
  CheckSeverity,
  CheckSummary,
  CheckVerdictBand,
  CheckVerdictEntry,
} from "@/lib/check/types"

import { ReportVerdict } from "@/components/check/report-verdict"

interface CheckVerdictProps {
  result: CheckResponse | null
  error: { code: string; message: string } | null
  isLoading: boolean
  /** The text the user pasted, echoed into the FP/FN report body. */
  pastedInput: string
}

const BAND_COPY: Record<
  CheckVerdictBand,
  { label: string; tone: string; ring: string; Icon: typeof ShieldCheck }
> = {
  clean: {
    label: "Clean",
    tone: "text-success",
    ring: "ring-success/20 bg-success/[0.04]",
    Icon: ShieldCheck,
  },
  caution: {
    label: "Caution",
    tone: "text-amber",
    ring: "ring-amber/20 bg-amber/[0.04]",
    Icon: AlertTriangle,
  },
  suspicious: {
    label: "Suspicious",
    tone: "text-amber",
    ring: "ring-amber/30 bg-amber/[0.06]",
    Icon: ShieldAlert,
  },
  "high-risk": {
    label: "High risk",
    tone: "text-destructive",
    ring: "ring-destructive/30 bg-destructive/[0.06]",
    Icon: ShieldAlert,
  },
}

function severityBadge(severity: CheckSeverity) {
  if (severity === "fail") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] h-5 gap-1 font-mono border-destructive/30 text-destructive"
      >
        <XCircle className="size-2.5" />
        fail
      </Badge>
    )
  }
  if (severity === "warn") {
    return (
      <Badge
        variant="outline"
        className="text-[10px] h-5 gap-1 font-mono border-amber/30 text-amber"
      >
        <AlertTriangle className="size-2.5" />
        warn
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="text-[10px] h-5 gap-1 font-mono border-success/30 text-success"
    >
      <CheckCircle2 className="size-2.5" />
      clean
    </Badge>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

export function CheckVerdict({ result, error, isLoading, pastedInput }: CheckVerdictProps) {
  if (isLoading) {
    return (
      <Card className="border-border/40 bg-card p-10 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <div className="relative size-10">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
        </div>
        <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          Running Context CI Top 10
        </p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/[0.03] p-6">
        <div className="flex items-start gap-3">
          <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-destructive">
              Scan refused
            </p>
            <p className="mt-1.5 text-sm text-foreground leading-relaxed">{error.message}</p>
            <p className="mt-3 text-[10px] font-mono text-muted-foreground">
              code: <span className="text-foreground">{error.code}</span>
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className="border-dashed border-border/50 bg-card/40 p-10 flex flex-col items-center justify-center gap-3 min-h-[280px]">
        <ShieldCheck className="size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
          Paste a skill, URL, or{" "}
          <code className="font-mono text-foreground/80">npx</code> command on the
          left. The verdict appears here.
        </p>
        <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
          Anonymous · no install · never executes
        </p>
      </Card>
    )
  }

  const band = BAND_COPY[result.summary.verdictBand]
  const BandIcon = band.Icon
  const filesWithFindings = result.files.filter((f) =>
    f.verdicts.some((v) => !v.passed),
  )

  return (
    <div className="space-y-4">
      {/* Headline card — score + verdict band + target */}
      <Card className={`border-border/40 bg-card overflow-hidden p-0`}>
        <div className={`px-5 py-5 ring-1 ${band.ring}`}>
          <div className="flex items-start gap-4">
            <BandIcon className={`size-8 shrink-0 ${band.tone}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-xl font-bold tracking-tight ${band.tone}`}>
                  {band.label}
                </h2>
                <span
                  className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground cursor-help"
                  title="100 = no signature risk. This measures signature/pattern risk, not trust or provenance (provenance is unwired) — a signature match is evidence of a pattern, not proof of malice."
                >
                  signature-risk score
                </span>
                <span className="font-mono tabular-nums text-base text-foreground">
                  {result.summary.signatureRiskScore ?? result.summary.trustScore}
                  <span className="text-muted-foreground">/100</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-foreground/90 break-all">
                {result.target.displayName}
              </p>
            </div>
          </div>
        </div>

        {/* Aggregate counters */}
        <div className="px-5 py-3 border-t border-border/40 flex flex-wrap items-center gap-4 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <XCircle className="size-2.5 text-destructive" />
            <span className="text-foreground tabular-nums">
              {result.summary.failCount}
            </span>{" "}
            fail
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="size-2.5 text-amber" />
            <span className="text-foreground tabular-nums">
              {result.summary.warnCount}
            </span>{" "}
            warn
          </span>
          <span
            className="inline-flex items-center gap-1.5 cursor-help"
            title="Detector checks that found nothing (detectors × files). This is NOT a count of clean files — see 'files clean'."
          >
            <CheckCircle2 className="size-2.5 text-success" />
            <span className="text-foreground tabular-nums">
              {result.summary.infoCount}
            </span>{" "}
            clean checks
          </span>
          {(result.mode === "npx" || result.mode === "github") &&
            typeof result.summary.cleanFiles === "number" && (
              <span
                className="inline-flex items-center gap-1.5 cursor-help"
                title="Scanned files where no detector fired."
              >
                <span className="text-foreground tabular-nums">
                  {result.summary.cleanFiles}
                </span>{" "}
                files clean
              </span>
            )}
          <span className="inline-flex items-center gap-1.5 ml-auto">
            <span className="text-foreground tabular-nums">
              {result.summary.detectorsRun}
            </span>{" "}
            detectors run
          </span>
        </div>
      </Card>

      {/* Why this score — surface the engine's own derivation so the
          headline number is explainable, not opaque (RC5). */}
      <ScoreRationale summary={result.summary} />

      {/* Target metadata — when present (npx / github / url) */}
      {(result.target.kind === "npm-package" ||
        result.target.kind === "github-repo" ||
        result.target.kind === "url") && <TargetMetadata result={result} />}

      {/* Per-detector verdicts */}
      <DetectorList verdicts={result.verdicts} />

      {/* Per-file breakdown — for any multi-file scan (npx, github)
          when at least one file had a finding. */}
      {(result.mode === "npx" || result.mode === "github") &&
        filesWithFindings.length > 0 && (
          <FileBreakdown files={filesWithFindings} />
        )}

      {/* FP / FN submission portal (ADR-0030 § 3). Opens GitHub's
          new-issue UI pre-filled with the four-path triage template. */}
      <ReportVerdict result={result} pastedInput={pastedInput} />
    </div>
  )
}

function TargetMetadata({ result }: { result: CheckResponse }) {
  if (result.target.kind === "npm-package" || result.target.kind === "github-repo") {
    const t = result.target
    const isGithub = t.kind === "github-repo"
    const Icon = isGithub ? Github : Package
    const title = isGithub ? "Repository" : "Package"
    const versionLabel = isGithub ? "Branch / ref" : "Version"
    return (
      <Card className="border-border/40 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="size-3 text-primary/70" />
          <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
          <Meta label="Name" value={t.name} />
          <Meta label={versionLabel} value={t.version} />
          <Meta label="Registry" value={t.registry} />
          <Meta label="Files" value={t.fileCount.toString()} />
          <Meta label="Compressed" value={formatBytes(t.compressedBytes)} />
          <Meta
            label="Unpacked"
            value={formatBytes(t.totalUncompressedBytes)}
          />
          {t.integrity && <Meta label="Integrity" value={t.integrity} span={2} mono />}
        </dl>
      </Card>
    )
  }
  if (result.target.kind === "url") {
    const t = result.target
    return (
      <Card className="border-border/40 bg-card p-4">
        <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">
          Fetched
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
          <Meta label="URL" value={t.url} span={2} mono />
          <Meta label="Bytes" value={formatBytes(t.bytes)} />
          <Meta label="Cap" value={formatBytes(t.maxBytes)} />
        </dl>
      </Card>
    )
  }
  return null
}

function Meta({
  label,
  value,
  span = 1,
  mono = false,
}: {
  label: string
  value: string
  span?: 1 | 2
  mono?: boolean
}) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <dt className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-foreground ${mono ? "font-mono break-all" : ""}`}
      >
        {value}
      </dd>
    </div>
  )
}

/** "Why this score" — renders the engine's own score derivation so the
 *  headline number is auditable instead of opaque. Reads the free-form
 *  `derivation` block off the wire; every field is accessed defensively
 *  (the exact key set is pinned by a test_check_api.py contract test). */
function ScoreRationale({ summary }: { summary: CheckSummary }) {
  const d = summary.derivation
  if (!d) return null
  const score = summary.signatureRiskScore ?? summary.trustScore
  const groups = d.top_groups ?? []
  const capped = typeof d.capped_penalty === "number" ? Math.round(d.capped_penalty) : null
  const wasCapped =
    typeof d.raw_penalty === "number" &&
    typeof d.risky_cap === "number" &&
    d.raw_penalty > d.risky_cap
  return (
    <Card className="border-border/40 bg-card p-4">
      <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">
        Why this score
      </h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-mono tabular-nums text-foreground">{score}</span>/100
        {capped !== null && (
          <>
            {" "}= 100 −{" "}
            <span className="font-mono tabular-nums text-foreground">{capped}</span> penalty
          </>
        )}
        {typeof d.n_risky_groups === "number" && (
          <>
            {" "}from{" "}
            <span className="font-mono tabular-nums text-foreground">{d.n_risky_groups}</span>{" "}
            distinct risk group{d.n_risky_groups === 1 ? "" : "s"}
          </>
        )}
        {wasCapped && (
          <>
            {" "}(raw {Math.round(d.raw_penalty as number)}, capped at {d.risky_cap})
          </>
        )}
        . A signature match is evidence of a pattern, not proof of malice.
      </p>
      {groups.length > 0 && (
        <ul className="mt-2 space-y-1">
          {groups.map((g, i) => (
            <li
              key={`${g.cciId}:${g.detailTag}:${i}`}
              className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground"
            >
              <span className="text-foreground">{g.cciId}</span>
              <span className="text-border">·</span>
              <span>{g.detailTag || "—"}</span>
              <span className="text-border">·</span>
              <span className="tabular-nums" title="occurrences (collapsed to one group)">
                ×{g.occurrences}
              </span>
              <span className="text-border">·</span>
              <span className="tabular-nums" title="penalty weight">
                −{g.weight}
              </span>
            </li>
          ))}
        </ul>
      )}
      {summary.classCounts && (
        <p className="mt-2 text-[10px] font-mono text-muted-foreground/80">
          classes: {summary.classCounts.malicious} malicious · {summary.classCounts.risky} risky
          · {summary.classCounts.policy} policy · {summary.classCounts.clean} clean
        </p>
      )}
    </Card>
  )
}

function DetectorList({ verdicts }: { verdicts: CheckVerdictEntry[] }) {
  // Sort: failures first, then warnings, then clean.
  const order = (s: CheckSeverity) => (s === "fail" ? 0 : s === "warn" ? 1 : 2)
  // Dedup identical verdicts. The npx/github multi-file path flattens one
  // Verdict per detector per file into `result.verdicts`, so the same
  // finding across N files produced N identical rows (and a React key
  // collision on the repeated detectorName). The scoring engine already
  // density-damps these to one group; the list now matches it and shows an
  // occurrence count. Single-blob scans (one file) are unaffected. RC5.
  const groups = new Map<string, { verdict: CheckVerdictEntry; count: number }>()
  for (const v of verdicts) {
    const key = `${v.detectorName}|${v.cciId}|${v.severity}|${v.summary}`
    const existing = groups.get(key)
    if (existing) existing.count += 1
    else groups.set(key, { verdict: v, count: 1 })
  }
  const sorted = [...groups.entries()].sort(
    ([, a], [, b]) => order(a.verdict.severity) - order(b.verdict.severity),
  )
  return (
    <Card className="border-border/40 bg-card p-4">
      <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">
        Detectors
      </h3>
      <ul className="space-y-2">
        {sorted.map(([key, g]) => (
          <DetectorRow key={key} verdict={g.verdict} occurrences={g.count} />
        ))}
      </ul>
    </Card>
  )
}

function DetectorRow({
  verdict,
  occurrences = 1,
}: {
  verdict: CheckVerdictEntry
  occurrences?: number
}) {
  const [expanded, setExpanded] = useState(verdict.severity !== "info")
  const hasHints = verdict.diffHints.length > 0
  return (
    <li
      className={`rounded-md border ${
        verdict.severity === "fail"
          ? "border-destructive/15 bg-destructive/[0.03]"
          : verdict.severity === "warn"
            ? "border-amber/15 bg-amber/[0.03]"
            : "border-border/40 bg-secondary/10"
      }`}
    >
      <button
        type="button"
        onClick={() => hasHints && setExpanded(!expanded)}
        className={`w-full px-3 py-2 flex items-center gap-2 text-left ${
          hasHints ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {hasHints ? (
          expanded ? (
            <ChevronDown className="size-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3 text-muted-foreground shrink-0" />
          )
        ) : (
          <span className="size-3 shrink-0" />
        )}
        {severityBadge(verdict.severity)}
        <span className="font-mono text-[11px] text-foreground shrink-0">
          {verdict.cciId || verdict.threatCategory}
        </span>
        <span className="text-[11px] text-foreground/90 truncate">
          {verdict.summary}
        </span>
        {occurrences > 1 && (
          <span
            className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground tabular-nums"
            title={`Same finding across ${occurrences} files — scored once`}
          >
            ×{occurrences}
          </span>
        )}
      </button>
      {hasHints && expanded && (
        <ul className="px-3 pb-3 pt-1 space-y-2">
          {verdict.diffHints.map((h, i) => (
            <li
              key={`${verdict.detectorName}-${i}`}
              className="rounded-sm bg-background/40 px-2.5 py-1.5 text-[11px]"
            >
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Info className="size-2.5" />
                  {h.detailTag || "match"}
                </span>
                {h.line !== null && (
                  <>
                    <span className="text-border">·</span>
                    <span>line {h.line}</span>
                  </>
                )}
              </div>
              <code className="block font-mono text-[10px] text-foreground/90 break-all whitespace-pre-wrap">
                {h.snippet}
              </code>
              <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                {h.suggestion}
              </p>
              {h.howToJudge && (
                <div className="mt-1.5 rounded-sm border-l-2 border-primary/40 bg-primary/[0.04] pl-2 py-1">
                  <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-primary/70">
                    Is this a real risk?
                  </span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
                    {h.howToJudge}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function FileBreakdown({ files }: { files: CheckFile[] }) {
  return (
    <Card className="border-border/40 bg-card p-4">
      <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-3">
        Files with findings
      </h3>
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.path} className="rounded-md border border-border/40 bg-secondary/10 px-3 py-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono text-[11px] text-foreground truncate">
                {f.path}
              </span>
              <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
                {formatBytes(f.bytes)}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {f.verdicts
                .filter((v) => !v.passed)
                .map((v) => (
                  <li key={`${f.path}:${v.detectorName}`}>
                    {severityBadge(v.severity)}
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                      {v.cciId || v.threatCategory}
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  )
}

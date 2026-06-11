import type { DaySample } from "@/lib/status"

/**
 * Sparkline — smoothed SVG area chart for a service's uptime history.
 *
 * Replaces the 90-vertical-stick chart that read as "tally marks
 * against an empty container." Same data; different shape. The
 * sparkline traces the uptime line, fills under it with a subtle
 * gradient, and overlays per-day cells only where the day was
 * degraded (so the eye lands on the trouble spots, not the
 * everything-OK runs).
 *
 * Pure presentation. No client state.
 */

interface SparklineProps {
  history: ReadonlyArray<DaySample>
  /** Drawing area in CSS pixels. Defaults render well at row scale. */
  width?: number
  height?: number
  /** Visual tone — drives the line + fill color. */
  tone?: "primary" | "amber" | "success" | "destructive"
  className?: string
}

const toneStroke = {
  primary: "rgb(34,211,232)",
  amber: "rgb(245,158,11)",
  success: "rgb(34,197,94)",
  destructive: "rgb(239,68,68)",
} as const

const toneFill = {
  primary: "rgba(34,211,232,0.18)",
  amber: "rgba(245,158,11,0.18)",
  success: "rgba(34,197,94,0.15)",
  destructive: "rgba(239,68,68,0.18)",
} as const

const dipFill = {
  operational: "transparent",
  degraded: "rgba(245,158,11,0.55)",
  "partial-outage": "rgba(239,68,68,0.55)",
  "major-outage": "rgba(239,68,68,0.85)",
} as const

export function Sparkline({
  history,
  width = 720,
  height = 48,
  tone = "success",
  className,
}: SparklineProps) {
  if (history.length === 0) return null

  // Clamp uptime to [99, 100] for vertical resolution — we want the
  // dips to be visible even when nominal uptime hovers near 100%.
  const yMin = 95
  const yMax = 100
  const xStep = width / (history.length - 1)

  const points = history.map((d, i) => {
    const x = i * xStep
    const clamped = Math.max(yMin, Math.min(yMax, d.uptime))
    const y = height - ((clamped - yMin) / (yMax - yMin)) * height
    return { x, y, state: d.state, uptime: d.uptime, date: d.date }
  })

  const lineD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")
  const fillD = `${lineD} L ${(points.at(-1)!.x).toFixed(2)} ${height} L 0 ${height} Z`

  // Width of each day "slot" for the degraded-cell overlay.
  const cellW = xStep

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {/* Degraded-day overlays — only render cells where the day
          was not operational, so the eye lands on the trouble. */}
      {points.map((p) =>
        p.state === "operational" ? null : (
          <rect
            key={p.date}
            x={p.x - cellW / 2}
            y={0}
            width={cellW}
            height={height}
            fill={dipFill[p.state]}
          />
        ),
      )}

      {/* Fill under the line */}
      <path d={fillD} fill={toneFill[tone]} />

      {/* Trend line */}
      <path
        d={lineD}
        fill="none"
        stroke={toneStroke[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Baseline 99% reference line */}
      <line
        x1={0}
        x2={width}
        y1={height - ((99 - yMin) / (yMax - yMin)) * height}
        y2={height - ((99 - yMin) / (yMax - yMin)) * height}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
    </svg>
  )
}

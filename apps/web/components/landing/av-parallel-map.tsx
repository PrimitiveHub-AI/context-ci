import Link from "next/link"
import { ArrowRight, ArrowUpRight, ShieldCheck } from "lucide-react"

import {
  listAVParallel,
  listAVParallelCompact,
  type AVParallelRow,
} from "@/lib/av-parallel"
import { GITHUB_BLOB_BASE } from "@/lib/site"

/**
 * AVParallelMap — visualizes ADR-0030 §3 + ADR-0040 §1 directly.
 *
 * Variants:
 *  - "compact" (5 rows, single line, dense): used on the homepage
 *    Trust Runtime Section. Honors the parallel session's "5
 *    sections, one viewport, one idea" discipline by living as a
 *    sub-block of an existing section, not a new one.
 *  - "full" (8 rows, multi-line with notes): used on /top-10 as
 *    the recognition primer above the 10-card grid.
 *
 * Discipline notes:
 *  - rows render their href as a Link when it's an in-tree route
 *    and as an external anchor with ArrowUpRight when it's a
 *    GitHub blob path
 *  - both variants read from the same lib/av-parallel.ts so the
 *    framing cannot drift between surfaces
 */

const GH_BLOB = GITHUB_BLOB_BASE

function RowTrailingLink({ row }: { row: AVParallelRow }) {
  if (row.href) {
    return (
      <Link
        href={row.href}
        className="inline-flex items-center gap-0.5 text-primary/85 hover:text-primary"
      >
        <ArrowRight className="size-3" />
      </Link>
    )
  }
  if (row.ghPath) {
    return (
      <a
        href={`${GH_BLOB}/${row.ghPath}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary/85 hover:text-primary"
      >
        <ArrowUpRight className="size-3" />
      </a>
    )
  }
  return null
}

export function AVParallelMap({
  variant = "full",
}: {
  variant?: "compact" | "full"
}) {
  const rows = variant === "compact" ? listAVParallelCompact() : listAVParallel()

  if (variant === "compact") {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-border/40 bg-card/50 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary/[0.07] text-primary">
              <ShieldCheck className="size-3" />
            </div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary/85">
              Already understand AV? Same posture, agent-context plane.
            </p>
          </div>
          <ul className="grid gap-x-6 gap-y-2 text-[12.5px] leading-snug md:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.avAnalog}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <span className="text-muted-foreground truncate">
                  {row.avAnalog}
                </span>
                <span className="text-muted-foreground/50">→</span>
                <span className="flex-1 truncate text-foreground/90">
                  {row.ours}
                </span>
                <RowTrailingLink row={row} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  // full variant — used on /top-10 to set the framing for the 10 cards
  return (
    <section className="mx-auto max-w-5xl">
      <div className="text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
          The reference frame
        </p>
        <h2 className="text-xl font-semibold text-foreground sm:text-2xl text-balance">
          You already understand this — it&rsquo;s AV for agent context.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          The antivirus industry shipped this product family thirty years
          ago. PrimitiveHub maps each AV surface to its agent-context
          equivalent — same posture, same lifecycle, different threat
          medium. Per <span className="font-mono">ADR-0030</span> §3 +{" "}
          <span className="font-mono">ADR-0040</span> §1.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-border/40 overflow-hidden">
        <div className="hidden grid-cols-12 gap-px bg-border/40 text-[10px] font-mono uppercase tracking-widest md:grid">
          <div className="bg-card/60 px-4 py-2.5 col-span-4 text-muted-foreground/80">
            What AV does
          </div>
          <div className="bg-card/60 px-4 py-2.5 col-span-7 text-primary/85">
            What PrimitiveHub does for agent context
          </div>
          <div className="bg-card/60 px-4 py-2.5 col-span-1" />
        </div>
        <div className="grid grid-cols-1 gap-px bg-border/40 md:grid-cols-12">
          {rows.map((row) => (
            <RowTriad key={row.avAnalog} row={row} />
          ))}
        </div>
      </div>
    </section>
  )
}

// On mobile each row is a stacked bg-card card (grid-cols-1 → one card per
// row, gap-px dividers between entries). On md+ the wrapper is `contents`
// so the three inner cells drop into the parent 12-col grid as the table.
function RowTriad({ row }: { row: AVParallelRow }) {
  return (
    <div className="bg-card p-4 md:contents">
      <div className="md:col-span-4 md:bg-card md:px-4 md:py-3">
        <p className="text-sm text-muted-foreground/90">{row.avAnalog}</p>
      </div>
      <div className="mt-1.5 md:mt-0 md:col-span-7 md:bg-card md:px-4 md:py-3">
        <p className="text-sm font-medium text-foreground/95">{row.ours}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
          {row.note}
        </p>
      </div>
      <div className="mt-2 flex items-center md:mt-0 md:col-span-1 md:justify-center md:bg-card md:px-3 md:py-3">
        <RowTrailingLink row={row} />
      </div>
    </div>
  )
}

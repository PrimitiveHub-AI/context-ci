import { ArrowUpRight } from "lucide-react"
import { GITHUB_BLOB_BASE } from "@/lib/site"

/**
 * EvaluationLink — every measured number, one click from its proof.
 *
 * Discipline: docs/principles.md Principle 1 ("Trust is cryptographic
 * or it doesn't exist") + Principle 7 ("No hallucinations as fact").
 * The site already reads numbers from the lib/evaluation.ts loader so
 * they can't go stale — but a number that looks measured is still
 * just text until the visitor can reach its reproducer. This wrapper
 * collapses that distance to a single hover-and-click.
 *
 * Where to use it:
 * - status pill / caption headlines that quote measured F1 or counts
 * - any per-detector number sourced from `bench/baseline/*-ts.json`
 *
 * Where NOT to use it:
 * - qualitative claims ("reproducible", "byte-identical") — those
 *   carry their own proof in the discipline, not a number
 * - demo numbers — those get <DemoDataBadge>, not this wrapper
 *
 * Default destination: docs/evaluation.md (the auto-rendered
 * scoreboard backed by the latest committed baseline). Pre-launch
 * this resolves to a GitHub blob; on launch day the same prose
 * lives at /docs/evaluation without changing this component.
 */

const GH_BLOB = GITHUB_BLOB_BASE

interface EvaluationLinkProps {
  /** Inline content to wrap — typically a measured value or label. */
  children: React.ReactNode
  /**
   * Optional override for the proof target. Defaults to
   * docs/evaluation.md. Use `corpus-map` to land on the per-CCI
   * sample index, `corpus` for the corpus spec, or pass a fully
   * qualified URL for anything else.
   */
  proof?: "evaluation" | "corpus-map" | "corpus" | "floor" | "gate" | string
  /** Title tooltip. Defaults to a paper-grade reproduction hint. */
  title?: string
  className?: string
}

function resolveProof(p?: string): string {
  switch (p) {
    case undefined:
    case "evaluation":
      return `${GH_BLOB}/docs/evaluation.md`
    case "corpus-map":
      return `${GH_BLOB}/docs/top10-corpus-map.md`
    case "corpus":
      return `${GH_BLOB}/docs/corpus-v0.1.md`
    case "floor":
      return `${GH_BLOB}/bench/baseline/FLOOR.md`
    case "gate":
      return `${GH_BLOB}/bench/scripts/gate.sh`
    default:
      return p
  }
}

export function EvaluationLink({
  children,
  proof,
  title = "Reproducible — open the scoreboard or run bench/scripts/gate.sh",
  className,
}: EvaluationLinkProps) {
  return (
    <a
      href={resolveProof(proof)}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className={[
        "inline-flex items-center gap-0.5 underline decoration-primary/40 decoration-dotted underline-offset-2 transition-colors hover:decoration-primary/80 hover:text-foreground",
        className ?? "",
      ].join(" ")}
    >
      {children}
      <ArrowUpRight className="size-2.5 shrink-0 opacity-60" aria-hidden />
    </a>
  )
}

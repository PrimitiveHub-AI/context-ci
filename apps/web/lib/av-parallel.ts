/**
 * AV-vendor product-family parallel for agent context.
 *
 * Locked in ADR-0030 § 3 + ADR-0040 § 1: PrimitiveHub is "agent-context
 * AV plus registry." Each surface we ship maps to exactly one slot in
 * the antivirus product family. The map below is the canonical
 * representation, shared between the homepage (compact) and /top-10
 * (full) so the framing reads identically on both surfaces.
 *
 * Why this matters: CISO buyers (ICP-1) already understand AV
 * vocabulary. Showing the parallel collapses 30 years of category
 * education into recognition. It is the sharpest single
 * category-creation move available to the project.
 *
 * Adding a row requires an ADR — the map is the contract.
 */

export interface AVParallelRow {
  /** The AV-industry analog the buyer already understands. */
  readonly avAnalog: string
  /** Our equivalent surface or artifact. */
  readonly ours: string
  /**
   * One-line plain-English description of what our surface does.
   * Kept short enough to fit a compact two-column row.
   */
  readonly note: string
  /**
   * Optional in-tree route the row links to. External-resource rows
   * (e.g. corpus, detectors) leave this undefined; the compact
   * variant renders them as text-only, the full variant adds a
   * GitHub blob fallback link in the component.
   */
  readonly href?: string
  /**
   * Optional GitHub blob/tree path (no protocol/host) for surfaces
   * whose proof lives in the repo rather than the website.
   */
  readonly ghPath?: string
  /**
   * Compact variant inclusion. The homepage shows only the rows
   * marked true; the /top-10 page shows all rows.
   */
  readonly inCompact: boolean
}

const ROWS: readonly AVParallelRow[] = [
  {
    avAnalog: "Threat encyclopedia",
    ours: "Context CI Top 10",
    note: "Ten supply-chain attack categories with stable CCI-NNN IDs.",
    href: "/top-10",
    inCompact: true,
  },
  {
    avAnalog: "AV-TEST lab benchmark",
    ours: "Adversarial corpus + measured F1",
    note: "Open labeled corpus; per-detector precision and recall published.",
    ghPath: "docs/evaluation.md",
    inCompact: true,
  },
  {
    avAnalog: "Signature database",
    ours: "Detectors T1–T10",
    note: "Mechanical detectors shipping in Python and TypeScript with byte-identical parity.",
    ghPath: "docs/top10-corpus-map.md",
    inCompact: false,
  },
  {
    avAnalog: "Cloud lookup",
    ours: "/check paste-and-verdict",
    note: "Paste anything. We show the risk before your agent reads it.",
    href: "/check",
    inCompact: true,
  },
  {
    avAnalog: "On-demand scanner",
    ours: "phub scan <file>",
    note: "Lint a single file you point at — passive, aimed.",
    href: "/docs/phub-cli",
    inCompact: false,
  },
  {
    avAnalog: "On-access guard",
    ours: "phub audit",
    note: "Active sweep — discovers and classifies every agent-context artifact in a repo.",
    href: "/docs/phub-cli",
    inCompact: true,
  },
  {
    avAnalog: "Allowlist + FP/FN portal",
    ours: "policy.yaml + FP/FN ledgers",
    note: "Numbered ledger discipline; every allow entry references its ledger row.",
    ghPath: "docs/false-positive-resolution.md",
    inCompact: true,
  },
  {
    avAnalog: "Provenance + signature store",
    ours: "Registry + Sigstore attestation",
    note: "SHA-256 content digest + Sigstore keyless OIDC; Rekor transparency log.",
    href: "/registry",
    inCompact: false,
  },
] as const

export function listAVParallel(): readonly AVParallelRow[] {
  return ROWS
}

export function listAVParallelCompact(): readonly AVParallelRow[] {
  return ROWS.filter((r) => r.inCompact)
}

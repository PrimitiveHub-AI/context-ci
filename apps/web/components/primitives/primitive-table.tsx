"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrustBadge } from "@/components/primitives/trust-badge"
import { ArrowUpDown, ArrowUp, ArrowDown, Copy } from "lucide-react"
import type { Primitive } from "@/lib/types"
import { cn } from "@/lib/utils"

type SortKey =
  | "name"
  | "status"
  | "version"
  | "qualityScore"
  | "safetyScore"
  | "tokens"
  | "lastUpdated"

type SortDirection = "asc" | "desc"

interface PrimitiveTableProps {
  primitives: Primitive[]
}

const SORTABLE: ReadonlyArray<{ key: SortKey; label: string; align?: "right" | "left" }> = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "version", label: "Version" },
  { key: "qualityScore", label: "Quality", align: "right" },
  { key: "safetyScore", label: "Safety", align: "right" },
  { key: "tokens", label: "Tokens", align: "right" },
  { key: "lastUpdated", label: "Updated" },
]

function scoreColor(score: number): string {
  if (score >= 95) return "text-success"
  if (score >= 90) return "text-primary"
  if (score >= 80) return "text-amber"
  return "text-destructive"
}

export function PrimitiveTable({ primitives }: PrimitiveTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("qualityScore")
  const [sortDir, setSortDir] = useState<SortDirection>("desc")
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // Numeric defaults to descending (largest first); text defaults to ascending
      const numeric: ReadonlyArray<SortKey> = ["qualityScore", "safetyScore", "tokens"]
      setSortDir(numeric.includes(key) ? "desc" : "asc")
    }
  }

  const sorted = useMemo(() => {
    const copy = [...primitives]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "status":
          cmp = a.status.localeCompare(b.status)
          break
        case "version":
          cmp = a.version.localeCompare(b.version, undefined, { numeric: true })
          break
        case "qualityScore":
          cmp = a.qualityScore - b.qualityScore
          break
        case "safetyScore":
          cmp = a.safetyScore - b.safetyScore
          break
        case "tokens":
          cmp = a.tokens - b.tokens
          break
        case "lastUpdated":
          cmp = a.lastUpdated.localeCompare(b.lastUpdated)
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [primitives, sortKey, sortDir])

  async function handleCopy(e: React.MouseEvent, primitive: Primitive) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(primitive.installCommand)
      setCopiedSlug(primitive.slug)
      setTimeout(() => setCopiedSlug(null), 1500)
    } catch {
      // ignore — older browsers
    }
  }

  function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
    if (!active) return <ArrowUpDown className="size-3 text-muted-foreground/50" />
    return dir === "asc" ? (
      <ArrowUp className="size-3 text-primary" />
    ) : (
      <ArrowDown className="size-3 text-primary" />
    )
  }

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <Table className="text-[12px]">
        <TableHeader>
          <TableRow className="border-border/40 hover:bg-transparent">
            {SORTABLE.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-9 text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-medium",
                  col.align === "right" && "text-right",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
                    col.align === "right" && "flex-row-reverse",
                  )}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {col.label}
                  <SortIcon active={sortKey === col.key} dir={sortDir} />
                </button>
              </TableHead>
            ))}
            <TableHead className="h-9 text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-medium">
              Agents
            </TableHead>
            <TableHead className="h-9 text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-medium text-right">
              Install
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((primitive) => {
            const tokenPercent = Math.round(
              (primitive.tokens / primitive.tokenBudget) * 100,
            )
            return (
              <TableRow
                key={primitive.slug}
                className="border-border/40 hover:bg-secondary/30 group"
              >
                {/* Name */}
                <TableCell className="py-2.5">
                  <Link
                    href={`/primitive/${primitive.slug}`}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="font-mono text-foreground/90 group-hover:text-primary transition-colors">
                      {primitive.fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1 max-w-[280px]">
                      {primitive.description}
                    </span>
                  </Link>
                </TableCell>

                {/* Status */}
                <TableCell className="py-2.5">
                  <TrustBadge status={primitive.status} />
                </TableCell>

                {/* Version */}
                <TableCell className="py-2.5 font-mono text-[11px] text-foreground/80 tabular-nums">
                  v{primitive.version}
                </TableCell>

                {/* Quality */}
                <TableCell
                  className={cn(
                    "py-2.5 text-right font-mono tabular-nums",
                    scoreColor(primitive.qualityScore),
                  )}
                >
                  {primitive.qualityScore}
                </TableCell>

                {/* Safety */}
                <TableCell
                  className={cn(
                    "py-2.5 text-right font-mono tabular-nums",
                    scoreColor(primitive.safetyScore),
                  )}
                >
                  {primitive.safetyScore}
                </TableCell>

                {/* Tokens with mini bar */}
                <TableCell className="py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                      {primitive.tokens.toLocaleString()}
                    </span>
                    <div className="token-bar w-12 h-1">
                      <div
                        className={cn(
                          "token-bar-fill h-full",
                          tokenPercent > 90 ? "bg-amber" : "bg-primary/50",
                        )}
                        style={{ width: `${Math.min(100, tokenPercent)}%` }}
                      />
                    </div>
                  </div>
                </TableCell>

                {/* Updated */}
                <TableCell className="py-2.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                  {primitive.lastUpdated}
                </TableCell>

                {/* Agents — count + dots */}
                <TableCell className="py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {primitive.compatibleAgents.length}
                    </span>
                    <span className="text-border">·</span>
                    <span className="text-[10px] text-muted-foreground/80 truncate max-w-[120px]">
                      {primitive.compatibleAgents.slice(0, 2).join(", ")}
                      {primitive.compatibleAgents.length > 2 && (
                        <span className="text-muted-foreground/50">
                          {" "}
                          +{primitive.compatibleAgents.length - 2}
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>

                {/* Install — copy button */}
                <TableCell className="py-2.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => handleCopy(e, primitive)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-secondary/40 px-2 py-1 text-[10px] font-mono text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
                      aria-label={`Copy install command for ${primitive.name}`}
                    >
                      <Copy className="size-2.5" />
                      {copiedSlug === primitive.slug ? (
                        <span className="text-success">copied</span>
                      ) : (
                        <span>phub install</span>
                      )}
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={SORTABLE.length + 2}
                className="py-10 text-center text-xs text-muted-foreground"
              >
                No primitives match your search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

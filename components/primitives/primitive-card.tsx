"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrustBadge } from "./trust-badge"
import { CompatibilityTags } from "./compatibility-tags"
import type { Primitive } from "@/lib/types"
import { Copy, FileText, Download, ArrowRight, Shield } from "lucide-react"
import { useState } from "react"

export function PrimitiveCard({ primitive }: { primitive: Primitive }) {
  const [copied, setCopied] = useState(false)
  const tokenPercent = Math.round((primitive.tokens / primitive.tokenBudget) * 100)

  function handleCopy() {
    navigator.clipboard.writeText(primitive.installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="group relative flex flex-col border-border bg-card transition-all hover:border-primary/20 hover:shadow-[0_0_30px_oklch(0.78_0.14_195/0.06)] overflow-hidden">
      {/* Top accent line */}
      <div className={`h-px w-full ${
        primitive.status === "Trusted" ? "bg-success/40" :
        primitive.status === "In Review" ? "bg-amber/40" :
        primitive.status === "Experimental" ? "bg-primary/40" :
        "bg-muted-foreground/20"
      }`} />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header: filename + trust */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 shrink-0 text-primary/70" />
            <Link
              href={`/primitive/${primitive.slug}`}
              className="truncate text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {primitive.fileName}
            </Link>
          </div>
          <TrustBadge status={primitive.status} />
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {primitive.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          <span>{primitive.author}</span>
          <span className="text-border">|</span>
          <span className="font-mono text-foreground/70">v{primitive.version}</span>
          <span className="text-border">|</span>
          <span className="font-mono">{primitive.license}</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <Download className="size-2.5" />
            {primitive.downloads.toLocaleString()}
          </span>
        </div>

        {/* Token budget bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Tokens</span>
          <div className="token-bar flex-1 h-1.5">
            <div
              className={`token-bar-fill h-full ${
                tokenPercent > 90 ? "bg-amber" : tokenPercent > 75 ? "bg-primary/70" : "bg-primary/50"
              }`}
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {primitive.tokens.toLocaleString()}/{primitive.tokenBudget.toLocaleString()}
          </span>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "QUA", value: primitive.qualityScore },
            { label: "SAF", value: primitive.safetyScore },
            { label: "EFF", value: primitive.contextEfficiency },
            { label: "IMP", value: primitive.agentImpact },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center rounded-md bg-secondary/50 px-1 py-1.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span className={`text-xs font-mono font-semibold ${
                s.value >= 95 ? "text-success" : s.value >= 90 ? "text-primary" : s.value >= 80 ? "text-amber" : "text-destructive"
              }`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Risk + Category */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] font-mono gap-1 ${
            primitive.riskLevel === "low" ? "border-success/20 text-success/80" :
            primitive.riskLevel === "medium" ? "border-amber/20 text-amber/80" :
            "border-destructive/20 text-destructive/80"
          }`}>
            <Shield className="size-2.5" />
            {primitive.riskLevel}
          </Badge>
          <Badge variant="secondary" className="text-[10px] text-muted-foreground">
            {primitive.category}
          </Badge>
        </div>

        {/* Compatibility */}
        <CompatibilityTags agents={primitive.compatibleAgents} />

        {/* Install command */}
        <div className="flex items-center gap-1.5 rounded-md bg-secondary/40 border border-border/50 px-2.5 py-1.5">
          <span className="text-[10px] font-mono text-primary/60 select-none">$</span>
          <code className="flex-1 text-[10px] font-mono text-muted-foreground truncate">
            {primitive.installCommand}
          </code>
          <button
            onClick={handleCopy}
            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Copy install command"
          >
            <Copy className="size-3" />
          </button>
          {copied && (
            <span className="text-[9px] font-mono text-success">copied</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          {primitive.reviewerBadge && (
            <span className="text-[10px] text-muted-foreground">
              Reviewed by <span className="text-foreground/70">{primitive.reviewerBadge}</span>
            </span>
          )}
          {!primitive.reviewerBadge && <span />}
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] text-muted-foreground hover:text-primary px-2" asChild>
            <Link href={`/primitive/${primitive.slug}`}>
              View Details
              <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}

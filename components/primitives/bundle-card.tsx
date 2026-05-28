"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CompatibilityTags } from "./compatibility-tags"
import type { Bundle } from "@/lib/types"
import { Package, Download, Copy, FileText, ArrowRight } from "lucide-react"
import { useState } from "react"

export function BundleCard({ bundle }: { bundle: Bundle }) {
  const [copied, setCopied] = useState(false)
  const tokenPercent = Math.round((bundle.totalTokens / bundle.totalBudget) * 100)

  function handleCopy() {
    navigator.clipboard.writeText(bundle.installCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="flex flex-col border-border bg-card transition-all hover:border-primary/20 hover:shadow-[0_0_30px_oklch(0.78_0.14_195/0.06)] overflow-hidden">
      <div className="h-px w-full bg-primary/30" />

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Package className="size-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{bundle.name}</h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                {bundle.primitives.length} primitives
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Download className="size-3" />
            {bundle.downloads.toLocaleString()}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{bundle.description}</p>

        {/* Primitives list */}
        <div className="rounded-md bg-secondary/30 border border-border/40 p-3 space-y-1.5">
          {bundle.primitives.map((p) => (
            <div key={p} className="flex items-center gap-2 text-xs">
              <FileText className="size-3 text-primary/50 shrink-0" />
              <span className="font-mono text-muted-foreground">{p}</span>
            </div>
          ))}
        </div>

        {/* Token budget */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Budget</span>
          <div className="token-bar flex-1 h-1.5">
            <div
              className="token-bar-fill h-full bg-primary/50"
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
            {bundle.totalTokens.toLocaleString()}/{bundle.totalBudget.toLocaleString()}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Quality: <span className="font-mono font-semibold text-success">{bundle.qualityAverage}</span>
          </span>
          <span className="text-border">|</span>
          <span>{bundle.useCase}</span>
        </div>

        {/* Compatibility */}
        <CompatibilityTags agents={bundle.compatibleAgents} />

        {/* Install command */}
        <div className="flex items-center gap-1.5 rounded-md bg-secondary/40 border border-border/50 px-2.5 py-1.5">
          <span className="text-[10px] font-mono text-primary/60 select-none">$</span>
          <code className="flex-1 text-[10px] font-mono text-muted-foreground truncate">
            {bundle.installCommand}
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

        {/* Action */}
        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5" size="sm">
          <Download className="size-3.5" />
          Install Bundle
        </Button>
      </div>
    </Card>
  )
}

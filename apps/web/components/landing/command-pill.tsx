"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

/**
 * Copyable command pill — the hero's dual "active sweep / on a known file"
 * install commands. Extracted to a client component so the copy button
 * actually writes to the clipboard (the Hero itself is a server component
 * that reads live evaluation data and can't hold interaction state).
 */
export function CommandPill({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — fail silently.
    }
  }

  return (
    <div className="group rounded-lg border border-border/60 bg-secondary/30 backdrop-blur-sm px-3 py-2.5 hover:border-primary/40 hover:bg-secondary/50 transition-colors">
      <p className="text-[9px] font-mono uppercase tracking-widest text-primary/70 mb-1">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-primary/50 select-none">$</span>
        <code className="flex-1 text-[12px] font-mono text-foreground/90 truncate">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={copied ? "Copied to clipboard" : `Copy command: ${command}`}
        >
          {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
        </button>
      </div>
    </div>
  )
}

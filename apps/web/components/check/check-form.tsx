"use client"

/**
 * Single-input paste panel for /check.
 *
 * One textarea. The user pastes anything — a skill, a URL, an `npx`
 * command, a `https://github.com/owner/repo`, a
 * `claude skill install owner/repo --skill foo`. The client sniffer
 * shows a "detected: …" badge so the user knows what the server is
 * about to do. The server's `mode=auto` does the real dispatch.
 */
import {
  ClipboardPaste,
  FileText,
  Github,
  Globe,
  Loader2,
  Package,
  Shield,
} from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { sniffMode, type SniffResult } from "@/lib/check/sniff"
import type { CheckMode } from "@/lib/check/types"

interface CheckFormProps {
  input: string
  isLoading: boolean
  onInputChange: (value: string) => void
  onSubmit: () => void
}

function iconForMode(mode: CheckMode) {
  if (mode === "github") return Github
  if (mode === "npx") return Package
  if (mode === "url") return Globe
  return FileText
}

export function CheckForm({
  input,
  isLoading,
  onInputChange,
  onSubmit,
}: CheckFormProps) {
  const detected: SniffResult | null = useMemo(() => sniffMode(input), [input])
  const canSubmit = input.trim().length > 0 && !isLoading
  const DetectedIcon = detected ? iconForMode(detected.mode) : ClipboardPaste

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  return (
    <Card className="border-border/40 bg-card overflow-hidden p-0">
      <div className="border-b border-border/40 bg-secondary/20 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="size-3 text-primary/70" />
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            Input
          </span>
        </div>
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/70">
          paste anything
        </span>
      </div>

      <p className="px-4 pt-4 text-[11px] leading-relaxed text-muted-foreground">
        A skill, a <code className="font-mono text-foreground/90">CLAUDE.md</code>,
        a <code className="font-mono text-foreground/90">https://</code> URL,
        a GitHub repo, an{" "}
        <code className="font-mono text-foreground/90">npx</code> command, a{" "}
        <code className="font-mono text-foreground/90">claude skill install</code>{" "}
        line &mdash; one input box, we figure out what it is and run the right
        scan.
      </p>

      <div className="px-4 pt-3 pb-3">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Paste a skill, CLAUDE.md, URL, GitHub repo, npx command, or any content to check"
          placeholder={
            "https://github.com/owner/repo\nnpx @scope/skill@1.2.3\nclaude skill install owner/repo --skill name\nor paste any markdown / prompt / config…"
          }
          className="font-mono text-[12px] min-h-[260px] resize-none bg-secondary/10"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {/* Detection badge — live mirror of the server's auto-router */}
      {detected && (
        <div className="border-t border-border/40 bg-secondary/10 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <DetectedIcon className="size-3 text-primary/70 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
                  detected
                </span>
                <span className="min-w-0 break-all text-[11px] font-mono text-foreground">
                  {detected.label}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                {detected.description}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border/40 bg-secondary/20 px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
          {input.length > 0 ? `${input.length.toLocaleString()} chars` : ""}
        </p>
        <Button
          size="sm"
          className="gap-1.5 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Shield className="size-3" />
              Check safety
              <span className="ml-1.5 hidden text-[9px] opacity-70 sm:inline">
                ⌘/Ctrl&nbsp;⏎
              </span>
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}

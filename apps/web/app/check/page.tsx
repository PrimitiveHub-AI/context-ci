"use client"

/**
 * /check — the public paste-and-verdict lookup surface (ADR-0034).
 *
 * One input box. Paste anything — a skill, a URL, an `npx` command,
 * a GitHub repo URL, a `claude skill install` line, raw content. The
 * server's `mode=auto` sniffs the input and dispatches to the right
 * pipeline. No account, no install, never executes.
 *
 * Daily-use frame: same reflex you have when you paste a suspicious
 * binary into VirusTotal — paste a suspicious context primitive here
 * and get a Top 10 verdict in under five seconds.
 */
import { useState } from "react"
import { Activity, Shield, ShieldAlert } from "lucide-react"

import { CheckForm } from "@/components/check/check-form"
import { CheckVerdict } from "@/components/check/check-verdict"
import type { CheckResponse } from "@/lib/check/types"

const STARTER_INPUT = "https://github.com/owner/repo"

export default function CheckPage() {
  const [input, setInput] = useState<string>(STARTER_INPUT)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit() {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "auto", input: input.trim() }),
      })
      const data = (await res.json()) as
        | CheckResponse
        | { error: { code: string; message: string } }
      if (!res.ok || "error" in data) {
        const err =
          "error" in data
            ? data.error
            : { code: `http-${res.status}`, message: "The server returned an error." }
        setError(err)
        return
      }
      setResult(data)
    } catch (exc) {
      setError({
        code: "network",
        message:
          exc instanceof Error
            ? `Could not reach /api/v1/check: ${exc.message}`
            : "Could not reach /api/v1/check.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
                Check
              </p>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Paste anything. We tell you if it&rsquo;s safe.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Drop in a skill, a URL, a GitHub repo, an{" "}
                <code className="font-mono text-foreground/90">npx</code> command,
                or a{" "}
                <code className="font-mono text-foreground/90">
                  claude skill install
                </code>{" "}
                line. We scan it against the Context CI Top 10 before any agent
                reads it. No account. No install. No execution &mdash; for
                tarballs, we fetch the bytes and read them, the way an AV scanner
                reads a binary.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="size-3 text-primary/70" /> 10 detectors
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="size-3 text-primary/70" /> auto-detect input
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="size-3 text-primary/70" /> never executed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <CheckForm
              input={input}
              isLoading={isLoading}
              onInputChange={setInput}
              onSubmit={handleSubmit}
            />
          </div>
          <div className="lg:col-span-7">
            <CheckVerdict result={result} error={error} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </main>
  )
}

"use client"

/**
 * Cmd-K search palette across docs / decisions / specs.
 *
 * Static index injected at render time by the parent server
 * component. Substring matching, ranked by:
 *
 *   - section weight (page-level > heading)
 *   - phrase position (earlier = higher)
 *   - exact-match boost
 *
 * No external search lib. The corpus is small enough (~800 entries)
 * that an in-memory pass on every keystroke is invisible.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"

import type { SearchEntry, SearchSection } from "@/lib/docs/search-index"

interface SearchPaletteProps {
  index: readonly SearchEntry[]
}

interface Match {
  entry: SearchEntry
  score: number
  /** Index into haystack where the first match starts (for snippet highlight). */
  matchStart: number
}

const MAX_RESULTS = 30

const SECTION_LABEL: Record<SearchSection, string> = {
  docs: "Docs",
  decisions: "Decisions",
  specs: "Specs",
}

const SECTION_HUE: Record<SearchSection, string> = {
  docs: "text-blue-400/80",
  decisions: "text-amber-400/80",
  specs: "text-emerald-400/80",
}

function scoreEntry(entry: SearchEntry, q: string): Match | null {
  const haystackTitle = (entry.headingText ?? entry.pageTitle).toLowerCase()
  const haystackDesc = (entry.description ?? "").toLowerCase()
  const tIdx = haystackTitle.indexOf(q)
  const dIdx = haystackDesc.indexOf(q)
  if (tIdx === -1 && dIdx === -1) return null

  let score = 0
  let matchStart = 0
  if (tIdx !== -1) {
    score += 1000
    score -= tIdx // earlier match is better
    if (haystackTitle === q) score += 500 // exact match
    matchStart = tIdx
  }
  if (dIdx !== -1) {
    score += 200
    score -= dIdx
  }
  // Page-level entries outrank heading entries at equal-quality match.
  if (entry.headingText === undefined) score += 100
  // h2 outranks h3.
  if (entry.headingDepth === 2) score += 50
  return { entry, score, matchStart }
}

function rankMatches(index: readonly SearchEntry[], rawQuery: string): Match[] {
  const q = rawQuery.trim().toLowerCase()
  if (q.length === 0) return []
  const matches: Match[] = []
  for (const entry of index) {
    const m = scoreEntry(entry, q)
    if (m !== null) matches.push(m)
  }
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, MAX_RESULTS)
}

function buildHref(entry: SearchEntry): string {
  if (entry.headingId !== undefined) return `${entry.pageUrl}#${entry.headingId}`
  return entry.pageUrl
}

function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  if (query.length === 0) return <>{text}</>
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-primary">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function SearchPalette({ index }: SearchPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focusIdx, setFocusIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => rankMatches(index, query), [index, query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setFocusIdx(0)
  }, [])

  // Cmd-K / Ctrl-K toggles the palette; Esc closes; / focuses if not in an input.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const k = ev.key.toLowerCase()
      const target = ev.target as HTMLElement | null
      const inField =
        target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      if ((ev.metaKey || ev.ctrlKey) && k === "k") {
        ev.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (k === "escape" && open) {
        ev.preventDefault()
        close()
        return
      }
      if (k === "/" && !inField && !open) {
        ev.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  // Focus the input each time the palette opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Reset focus when the result set changes.
  useEffect(() => {
    setFocusIdx(0)
  }, [matches])

  function onInputKey(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === "ArrowDown") {
      ev.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, matches.length - 1))
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (ev.key === "Enter" && matches.length > 0) {
      const m = matches[focusIdx]
      if (m === undefined) return
      ev.preventDefault()
      window.location.href = buildHref(m.entry)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-3 hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs sm:inline">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search documentation"
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-center border-b border-border px-4 py-3">
              <svg
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                onKeyDown={onInputKey}
                type="text"
                placeholder="Search docs, decisions, specs…"
                className="ml-3 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                aria-label="Search query"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim().length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Type to search across docs, decisions, and specs.
                </div>
              ) : matches.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No matches for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <ul role="listbox">
                  {matches.map((m, i) => {
                    const e = m.entry
                    const label = e.headingText ?? e.pageTitle
                    return (
                      <li key={`${e.pageUrl}#${e.headingId ?? ""}-${i}`} role="option" aria-selected={i === focusIdx}>
                        <Link
                          href={buildHref(e)}
                          onClick={close}
                          className={`flex items-start gap-3 border-b border-border px-4 py-3 transition-colors ${
                            i === focusIdx ? "bg-primary/10" : "hover:bg-primary/5"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${SECTION_HUE[e.section]}`}
                          >
                            {SECTION_LABEL[e.section]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">
                              <HighlightedText text={label} query={query} />
                            </span>
                            {e.headingText !== undefined ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                in {e.pageTitle}
                              </span>
                            ) : e.description !== undefined ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                <HighlightedText text={e.description} query={query} />
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border bg-background/60 px-4 py-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border px-1 py-0.5 font-mono">⏎</kbd>
                Open
              </span>
              <span className="ml-auto font-mono text-[10px]">{matches.length} result{matches.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

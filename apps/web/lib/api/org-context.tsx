/**
 * Active-organization context.
 *
 * Multi-tenant flow:
 *   1. The backend reads `X-Organization-Slug` per request and resolves
 *      it to the tenant whose RLS policy will apply. Missing header → the
 *      user's first org by slug (deterministic default).
 *   2. This context tracks which org the frontend is "acting in" and is
 *      read by `apiFetch` to send the header on every call.
 *   3. The picker UI lets users with multiple memberships switch.
 *
 * Persistence: localStorage. Cookie-based persistence (SSR-safe) is a
 * Phase 7 follow-up — for now the SSR-rendered shell pages don't
 * include any tenant-scoped data, so a missing header on the first paint
 * is harmless.
 */

"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "primitivehub:active-org-slug"

interface OrgContextValue {
  /** The slug sent as X-Organization-Slug on API requests, or null if
   *  the user hasn't picked one (backend falls back to its default). */
  activeOrgSlug: string | null
  /** Imperative setter. Persists to localStorage as a side-effect. */
  setActiveOrgSlug: (slug: string | null) => void
}

const OrgContext = createContext<OrgContextValue | null>(null)

export function OrgContextProvider({ children }: { children: ReactNode }) {
  const [activeOrgSlug, setActiveSlugState] = useState<string | null>(null)

  // Hydrate from localStorage after mount. SSR + client first-render
  // produce the same `null` so React doesn't complain about a mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored) setActiveSlugState(stored)
    } catch {
      // private mode, etc.
    }
  }, [])

  const setActiveOrgSlug = useCallback((slug: string | null) => {
    setActiveSlugState(slug)
    try {
      if (slug === null) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, slug)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(
    () => ({ activeOrgSlug, setActiveOrgSlug }),
    [activeOrgSlug, setActiveOrgSlug],
  )

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

export function useActiveOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) {
    // Outside the provider (e.g. unit tests, isolated stories): degrade
    // to a no-op rather than throwing. The header simply isn't sent and
    // the backend uses its default.
    return { activeOrgSlug: null, setActiveOrgSlug: () => {} }
  }
  return ctx
}

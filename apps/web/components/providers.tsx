/**
 * Client-side providers wrapper.
 *
 * TanStack QueryClient is constructed once per browser session via
 * `useState(() => …)` so React Strict Mode's double-render in dev
 * doesn't produce two clients fighting over cache. The Devtools panel
 * is dev-only (tree-shaken in prod by the NODE_ENV guard).
 */

"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState, type ReactNode } from "react"
import { OrgContextProvider } from "@/lib/api/org-context"

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Match the registry's slow update cadence; per-hook overrides win.
            staleTime: 5 * 60 * 1000,
            // Retries cost API ops; default to a single retry on network errors.
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <OrgContextProvider>
        {children}
        {process.env.NODE_ENV === "development" && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
        )}
      </OrgContextProvider>
    </QueryClientProvider>
  )
}

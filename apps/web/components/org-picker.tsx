/**
 * Active-organization picker.
 *
 * Visibility rules
 *   - Hidden while the memberships query is loading (no chrome flicker).
 *   - Hidden when the user belongs to 0 or 1 orgs — there's nothing to
 *     pick. The backend default tenant resolver works correctly without
 *     a header in those cases.
 *   - Visible only when there's a real choice to make.
 *
 * Persists the selection via `useActiveOrg()` (localStorage under the hood).
 * Switching the active org invalidates all org-scoped TanStack queries
 * via the `activeOrgSlug` segment of their keys.
 */

"use client"

import { Check, ChevronDown, Building2 } from "lucide-react"
import { useEffect } from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useActiveOrg } from "@/lib/api/org-context"
import { useOrganizations } from "@/lib/api/queries"

export function OrgPicker() {
  const { data: memberships, isLoading } = useOrganizations()
  const { activeOrgSlug, setActiveOrgSlug } = useActiveOrg()

  const orgs = memberships ?? []

  // Auto-pick the first org on first mount if the user has any and
  // hasn't already chosen one. Keeps localStorage in sync with the
  // implicit backend default so the header is sent immediately.
  useEffect(() => {
    if (!activeOrgSlug && orgs.length > 0) {
      setActiveOrgSlug(orgs[0].organization.slug)
    }
  }, [activeOrgSlug, orgs, setActiveOrgSlug])

  if (isLoading || orgs.length < 2) return null

  const current =
    orgs.find((m) => m.organization.slug === activeOrgSlug)?.organization ??
    orgs[0]?.organization

  if (!current) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[13px] h-7 text-muted-foreground hover:text-foreground"
        >
          <Building2 className="size-3" />
          <span className="font-mono text-foreground/80">{current.slug}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <p className="px-2 pt-1.5 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-mono">
          Active organization
        </p>
        {orgs.map(({ organization }) => {
          const active = organization.slug === current.slug
          return (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => setActiveOrgSlug(organization.slug)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex flex-col">
                <span className="text-[13px] text-foreground">{organization.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {organization.slug}
                </span>
              </span>
              {active && <Check className="size-3 text-primary" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

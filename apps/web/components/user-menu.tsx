/**
 * Authenticated user menu — avatar + name → dropdown with sign-out.
 *
 * Rendering rule: returns null while whoami is loading (no chrome
 * flicker) and when the session is anonymous. The navbar shows a "Sign
 * in" link in that case instead. This component is the authenticated-
 * state replacement.
 *
 * Avatar: initials from displayName. A real avatar URL lands when the
 * Authentik picture claim wires through /api/v1/whoami (Phase 5+).
 */

"use client"

import { LogOut, Settings } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWhoami } from "@/lib/api/queries"

function initialsFor(name: string): string {
  // Quiet, restrained 2-char initials. Falls back to first 2 chars
  // when the name lacks a space (e.g. an email or a single token).
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const { data: session, isLoading } = useWhoami()
  if (isLoading || !session?.authenticated || !session.user) return null

  const { user } = session
  const display = user.displayName || user.email || user.subject

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Account menu for ${display}`}
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-primary/10 text-[10px] font-mono text-primary">
              {initialsFor(display)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden lg:inline max-w-[140px] truncate">
            {display}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-[13px] text-foreground">{display}</span>
          {user.email && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
          <Settings className="size-3" />
          Settings
          <span className="ml-auto text-[9px] font-mono opacity-60">soon</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/auth/logout" className="flex items-center gap-2">
            <LogOut className="size-3" />
            Sign out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

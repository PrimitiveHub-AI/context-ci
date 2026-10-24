"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Github, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { OrgPicker } from "@/components/org-picker"
import { UserMenu } from "@/components/user-menu"
import { useWhoami } from "@/lib/api/queries"
import { isEnabled } from "@/lib/flags"
import { PlannedBadge } from "@/components/ui/planned-badge"
import { GITHUB_REPO_URL } from "@/lib/site"

// Ordered by the AV-family funnel (ADR-0040 §1): first touch
// (Check) → research/encyclopedia (Top 10) → on-demand scan
// (Context CI) → authoring (Forge) → discovery (Registry — now
// includes Bundles) → CLI + service docs → research (Paper).
// Bundles folds into Registry per ADR-0040 §2; Contributors moves
// to the footer.
// The two flagships lead: Check (inspect anything) + Skill IDE (author
// safely), then the supporting surfaces.
const navLinks: { href: string; label: string; soon?: boolean }[] = [
  { href: "/check", label: "Check" },
  { href: "/skill-ide", label: "Skill IDE" },
  { href: "/top-10", label: "Top 10" },
  { href: "/validation", label: "Context CI", soon: true },
  { href: "/registry", label: "Registry", soon: true },
  { href: "/docs", label: "Docs" },
  { href: "/paper", label: "Paper" },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useWhoami()
  const authenticated = Boolean(session?.authenticated)
  const authEnabled = isEnabled("auth")

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-foreground group">
            <Image
              src="/brand/logo-mark.png"
              alt=""
              width={17}
              height={24}
              priority
              className="h-6 w-auto transition-transform duration-200 group-hover:scale-105"
            />
            <span className="text-[13px] font-semibold tracking-tight">
              Primitive<span className="text-primary">Hub</span>
            </span>
            <span className="hidden rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono text-primary sm:inline-block">
              beta
            </span>
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
                {link.soon && (
                  <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    soon
                  </span>
                )}
                {pathname === link.href && (
                  <span className="absolute bottom-0 left-1/2 h-px w-4 -translate-x-1/2 bg-primary" />
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          {authEnabled && <OrgPicker />}
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" asChild>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <Github className="size-3.5" />
            </a>
          </Button>
          <div className="mx-1.5 h-4 w-px bg-border" />
          {authenticated ? (
            <UserMenu />
          ) : authEnabled ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-[13px] h-7"
              asChild
            >
              <a href="/auth/login">Sign in</a>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled
              title="Accounts — planned with publishing"
              aria-label="Sign in — planned with publishing"
              className="text-muted-foreground/50 text-[13px] h-7 cursor-not-allowed"
            >
              Sign in
            </Button>
          )}
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] h-7" asChild>
            <Link href="/check">Run a check</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11 md:hidden text-muted-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>
      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-border/40 bg-background px-4 py-3 md:hidden">
          <nav aria-label="Mobile" className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  pathname === link.href
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{link.label}</span>
                {link.soon && (
                  <span className="rounded-sm bg-muted px-1 py-px text-[8px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    soon
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
            {authEnabled ? (
              <Button variant="outline" size="sm" className="text-[13px]" asChild>
                <a href="/auth/login">Sign in</a>
              </Button>
            ) : (
              <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
                <span className="text-[13px] text-muted-foreground/60">Sign in</span>
                <PlannedBadge label="Planned" />
              </div>
            )}
            <Button size="sm" className="bg-primary text-primary-foreground text-[13px]" asChild>
              <Link href="/check">Run a check</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

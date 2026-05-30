"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Github, Menu, X, Hexagon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { OrgPicker } from "@/components/org-picker"
import { UserMenu } from "@/components/user-menu"
import { useWhoami } from "@/lib/api/queries"

const navLinks = [
  { href: "/registry", label: "Registry" },
  { href: "/bundles", label: "Bundles" },
  { href: "/workbench", label: "Workbench" },
  { href: "/validation", label: "Context CI" },
  { href: "/paper", label: "Paper" },
  { href: "/contributors", label: "Contributors" },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { data: session } = useWhoami()
  const authenticated = Boolean(session?.authenticated)

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-foreground group">
            <Hexagon className="size-4.5 text-primary transition-transform group-hover:rotate-12" />
            <span className="text-[13px] font-semibold tracking-tight">PrimitiveHub</span>
            <span className="hidden rounded-sm bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono text-primary sm:inline-block">
              beta
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  pathname === link.href
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
                {pathname === link.href && (
                  <span className="absolute bottom-0 left-1/2 h-px w-4 -translate-x-1/2 bg-primary" />
                )}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">
          <OrgPicker />
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" asChild>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <Github className="size-3.5" />
            </a>
          </Button>
          <div className="mx-1.5 h-4 w-px bg-border" />
          {authenticated ? (
            <UserMenu />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-[13px] h-7"
              asChild
            >
              <a href="/auth/login">Sign in</a>
            </Button>
          )}
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] h-7" asChild>
            <Link href="/registry">Explore Primitives</Link>
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden text-muted-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </Button>
      </div>
      {mobileOpen && (
        <div className="border-t border-border/40 bg-background px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === link.href
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-border/40 pt-3">
            <Button variant="outline" size="sm" className="text-[13px]">Sign in</Button>
            <Button size="sm" className="bg-primary text-primary-foreground text-[13px]" asChild>
              <Link href="/registry">Explore Primitives</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  )
}

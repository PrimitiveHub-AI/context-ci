import { Hero } from "@/components/landing/hero"
import { ThreatVerifiedSection } from "@/components/landing/threat-verified-section"
import { TrustRuntimeSection } from "@/components/landing/trust-runtime-section"
import { CLIRoadmap } from "@/components/landing/cli-roadmap"
import { SiteFooter } from "@/components/landing/site-footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

/**
 * Landing page — 5 sections (homepage-elite-bar.md).
 *
 * Each viewport carries one idea and proves the single message
 * ("verify agent context before the agent reads it"):
 *   Hero → Threat→Verified → Trust Runtime → CLI → CTA + Footer.
 * The old WhySection / ConceptSection / FeaturesSection were merged or
 * cut in the 2026-06-09 subtraction pass — do not re-add without merging.
 */
export default function LandingPage() {
  return (
    <main>
      <Hero />
      <ThreatVerifiedSection />
      <TrustRuntimeSection />
      <CLIRoadmap />

      {/* Final CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="mx-auto max-w-lg text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
              Get Started
            </p>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
              The trusted cognition supply chain
              <br />
              starts here.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Explore trusted primitives, install them into your AI agent, and
              immediately improve output quality with validated, expert-authored
              cognition modules. No configuration required.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10"
                asChild
              >
                <Link href="/registry">
                  Explore Trusted Primitives
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-10 border-border/60" asChild>
                <Link href="/paper">Read the Paper</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}

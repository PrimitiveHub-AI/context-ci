import { Hero } from "@/components/landing/hero"
import { WhySection } from "@/components/landing/why-section"
import { ConceptSection } from "@/components/landing/concept-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { CLIRoadmap } from "@/components/landing/cli-roadmap"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <WhySection />
      <ConceptSection />
      <FeaturesSection />
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

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-col items-center gap-0.5 sm:items-start">
              <p className="text-xs text-muted-foreground">
                PrimitiveHub, 2026. The trusted cognition registry.
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/60 tracking-wide">
                Powered by{" "}
                <a
                  href="https://cyberorca.sa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary/80 transition-colors"
                >
                  CyberOrca.sa
                </a>
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/paper" className="hover:text-foreground transition-colors">Paper</Link>
              <Link href="/contributors" className="hover:text-foreground transition-colors">Contributors</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}

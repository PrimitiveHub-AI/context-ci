import Link from "next/link"
import type { Metadata } from "next"
import {
  Shield,
  Mail,
  ArrowUpRight,
  AlertOctagon,
  Scale,
} from "lucide-react"

import { docRoute } from "@/lib/site"

/**
 * /security — top-level security landing.
 *
 * Mirrors the three report lanes from SECURITY.md (vulnerability /
 * false-negative / false-positive). Canonical text lives in the
 * markdown files at the repo root; this page is the discoverable web
 * surface that routes a reader to the right lane in one click.
 *
 * PrimitiveHub is a research initiative, NOT a commercial program:
 * there is no paid bug-bounty. Reports are coordinated and reporters
 * are credited in the public closure ledger — recognition, not cash.
 */

export const metadata: Metadata = {
  title: "Security — PrimitiveHub",
  description:
    "Three lanes for reporting: vulnerabilities go to security@primitivehub.ai, false negatives to the FN ledger, false positives to the FP ledger. Coordinated disclosure; reporters credited in the public ledger (research initiative — no paid bounty).",
}

const RESPONSE_STAGES: ReadonlyArray<{
  stage: string
  target: string
  what: string
}> = [
  {
    stage: "Acknowledge receipt",
    target: "≤ 24 hours",
    what: "A human (not an autoresponder) replies with a tracking ID.",
  },
  {
    stage: "Triage decision",
    target: "≤ 72 hours",
    what: "We confirm scope + severity, or explain why a report falls out of scope.",
  },
  {
    stage: "Public-disclosure window",
    target: "90 days from triage",
    what: "Coordinated. Extendable by mutual agreement for cryptographic findings.",
  },
  {
    stage: "Fix shipped",
    target: "When ready",
    what: "Reporter notified and credited in the public ledger when the fix ships.",
  },
  {
    stage: "Public post-mortem",
    target: "≤ 30 days after fix",
    what: "Written up in docs/bugs.md with the reporter's preferred credit.",
  },
]

export default function SecurityPage() {
  return (
    <main className="relative mx-auto max-w-5xl px-4 py-16 lg:px-6">
      {/* Layered backdrop for depth */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.14_195/0.07)_0%,transparent_55%)] -z-10"
      />

      {/* Header */}
      <header className="mb-12">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
          Security
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl text-balance">
          Three lanes. <span className="text-primary glow-text-cyan">One discipline.</span>
        </h1>
        <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed max-w-2xl">
          PrimitiveHub is &ldquo;agent-context AV plus registry&rdquo; per{" "}
          <a
            href={docRoute("docs/decisions/0030-fp-resolution-and-av-vendor-parallel.md")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/90 hover:text-primary"
          >
            ADR-0030
          </a>
          . The classical AV-vendor playbook ships three public report
          lanes; we ship the same three from day one.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <a
            href="mailto:security@primitivehub.ai?subject=%5Bsecurity%5D%20"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/[0.06] px-3 py-1.5 text-primary/95 hover:text-primary hover:bg-primary/[0.10] transition-colors"
          >
            <Mail className="size-3" />
            security@primitivehub.ai
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1.5 text-muted-foreground">
            ack ≤ 24h · triage ≤ 72h · disclosure 90d
          </span>
        </div>
      </header>

      {/* The three lanes */}
      <section className="mb-16 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Lane
          icon={<AlertOctagon className="size-5 text-destructive/80" />}
          tag="Vulnerability"
          title="Infrastructure compromise"
          desc="A bug in PrimitiveHub itself — signing, RLS, API, worker, CLI, MCP, verify kernel, GitHub Action."
          cta="security@primitivehub.ai"
          ctaHref="mailto:security@primitivehub.ai?subject=%5Bsecurity%5D%20"
          note="Coordinated disclosure; credited in the public closure ledger."
        />
        <Lane
          icon={<Shield className="size-5 text-amber/80" />}
          tag="False negative"
          title="A missed attack"
          desc="Context CI passed something you believe contains an attack — corpus or detector should catch it."
          cta="FN-NNN ledger"
          ctaHref={docRoute("docs/false-negative-resolution.md")}
          external
          note="Credit in the public closure ledger (research-credit currency)."
        />
        <Lane
          icon={<Shield className="size-5 text-success/80" />}
          tag="False positive"
          title="A legitimate primitive flagged"
          desc="Context CI flagged a primitive you believe should pass — the four-path triage decides what to do."
          cta="FP-NNN ledger"
          ctaHref={docRoute("docs/false-positive-resolution.md")}
          external
          note="Credit in the public closure ledger (research-credit currency)."
        />
      </section>

      {/* Recognition — research-credit, not cash. PrimitiveHub is a
          research initiative; there is no paid bug-bounty programme. */}
      <section id="recognition" className="scroll-mt-24 mb-16">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="size-4 text-primary/80" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-primary/85">
            Recognition
          </h2>
        </div>
        <h3 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
          Credit, not cash.
        </h3>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
          PrimitiveHub is a research initiative, not a commercial
          product — there is <span className="text-foreground/90">no paid
          bug-bounty programme</span>. We coordinate disclosure, fix the
          issue, and credit reporters by name (or their preferred handle)
          in the public closure ledger and the post-mortem at the time the
          fix ships. Reports are gratefully accepted and taken seriously;
          the currency is research credit.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={docRoute("SECURITY.md")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Read SECURITY.md (encrypted-reporting setup + lanes)
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </section>

      {/* Response timeline */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-3">
          <Mail className="size-4 text-primary/80" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-primary/85">
            Response timeline
          </h2>
        </div>
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="grid grid-cols-12 gap-px bg-border/40 text-[10px] font-mono uppercase tracking-widest">
            <div className="bg-card/60 px-4 py-2.5 col-span-3 text-muted-foreground/80">
              Stage
            </div>
            <div className="bg-card/60 px-4 py-2.5 col-span-3 text-primary/85">
              Target
            </div>
            <div className="bg-card/60 px-4 py-2.5 col-span-6 text-muted-foreground/80">
              What happens
            </div>
          </div>
          <div className="grid grid-cols-12 gap-px bg-border/40">
            {RESPONSE_STAGES.map((s) => (
              <ResponseRow key={s.stage} {...s} />
            ))}
          </div>
        </div>
      </section>

      {/* Safe harbour quick */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-3">
          <Scale className="size-4 text-primary/80" />
          <h2 className="text-sm font-mono uppercase tracking-wider text-primary/85">
            Safe harbour
          </h2>
        </div>
        <div className="rounded-xl border border-border/40 bg-card p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            PrimitiveHub will not pursue civil action or initiate
            criminal complaint against researchers who follow this
            policy in good faith. If a researcher follows the policy
            and inadvertently violates a CFAA-class statute in their
            jurisdiction, we will not initiate legal action and will,
            if asked, support good-faith research in any proceeding.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            If you cannot tell whether a test you want to run falls
            inside the safe harbour,{" "}
            <a
              href="mailto:security@primitivehub.ai?subject=%5Bsafe-harbour%5D%20"
              className="text-primary/90 hover:text-primary"
            >
              ask first
            </a>
            . We answer fast.
          </p>
        </div>
      </section>

      {/* Cross-references */}
      <section className="rounded-xl border border-border/40 bg-card/50 p-6">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-3">
          Related
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href={docRoute("docs/bugs.md")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              docs/bugs.md — public post-mortems for closed incidents
              <ArrowUpRight className="size-3" />
            </a>
          </li>
          <li>
            <Link
              href="/docs/trust-contract"
              className="text-muted-foreground hover:text-foreground"
            >
              docs/trust-contract — what the verifier guarantees, and what it does when its dependency degrades
            </Link>
          </li>
          <li>
            <Link
              href="/status"
              className="text-muted-foreground hover:text-foreground"
            >
              /status — planned live-status page for each shipped surface (the monitoring backend is not live yet)
            </Link>
          </li>
        </ul>
      </section>
    </main>
  )
}

interface LaneProps {
  icon: React.ReactNode
  tag: string
  title: string
  desc: string
  cta: string
  ctaHref: string
  external?: boolean
  note: string
}

function Lane({ icon, tag, title, desc, cta, ctaHref, external, note }: LaneProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">{icon}</div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {tag}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{desc}</p>
      <a
        href={ctaHref}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-primary/90 hover:text-primary"
      >
        {cta}
        <ArrowUpRight className="size-3" />
      </a>
      <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">{note}</p>
    </div>
  )
}

function ResponseRow({ stage, target, what }: { stage: string; target: string; what: string }) {
  return (
    <>
      <div className="bg-card px-4 py-3 col-span-3">
        <p className="text-sm font-medium text-foreground">{stage}</p>
      </div>
      <div className="bg-card px-4 py-3 col-span-3">
        <p className="text-sm font-mono text-primary/90 tabular-nums">{target}</p>
      </div>
      <div className="bg-card px-4 py-3 col-span-6">
        <p className="text-[11px] text-muted-foreground leading-relaxed">{what}</p>
      </div>
    </>
  )
}

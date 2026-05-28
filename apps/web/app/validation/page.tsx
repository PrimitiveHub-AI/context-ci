import { Card } from "@/components/ui/card"
import { PipelineStage } from "@/components/primitives/pipeline-stage"
import { ScoreBadge } from "@/components/primitives/score-badge"
import { LifecycleTimeline } from "@/components/primitives/lifecycle-timeline"
import { DemoDataBadge } from "@/components/primitives/demo-data-badge"
import { pipelineStages } from "@/lib/data/pipeline"
import { Badge } from "@/components/ui/badge"
import { ShieldCheck, FileText, Fingerprint, Clock } from "lucide-react"

export default function ValidationPage() {
  return (
    <main className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
            Context CI
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            The validation pipeline for AI cognition
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Every trusted primitive passes through 10 automated and human review stages before
            entering the registry. Schema validation. Safety scanning. Contradiction detection.
            Agent benchmarking. Expert human review. Attested release. This is Context CI --
            infrastructure-grade validation for cognition files.
          </p>
        </div>
      </div>

      {/* Lifecycle Timeline — the macro view */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <LifecycleTimeline currentStage="Context CI" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {/* Demo-data disclosure */}
        <div className="mb-4 flex items-center gap-2">
          <DemoDataBadge label="demo run" />
          <span className="text-[10px] text-muted-foreground/70">
            illustrative pipeline output — live Context CI runs replace this when v1 ships
          </span>
        </div>

        {/* Current run header */}
        <Card className="border-border/40 bg-card p-5 mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/[0.08]">
                <ShieldCheck className="size-5 text-success" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="size-3.5 text-primary/60" />
                  <span className="text-sm font-mono font-semibold text-foreground">
                    secure-code-review.md
                  </span>
                  <Badge className="bg-success/[0.08] text-success border-success/20 text-[10px] font-mono">
                    passed
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-mono border-border/60 text-muted-foreground">
                    v1.2.0
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Fingerprint className="size-2.5 text-primary/50" />
                    <span className="font-mono">digest sha256:c9d1e2f4a7b85c3d</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-2.5" />
                    Total: 2d 4h 21.4s
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <ScoreBadge label="Quality" score={94} />
              <ScoreBadge label="Safety" score={99} />
              <ScoreBadge label="Efficiency" score={87} />
              <ScoreBadge label="Impact" score={91} />
            </div>
          </div>
        </Card>

        {/* Pipeline stages */}
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground mb-1">Pipeline Stages</h2>
          <p className="text-xs text-muted-foreground">
            10 stages from submission to attested trusted release. Each stage must pass before proceeding.
          </p>
        </div>

        <div className="space-y-2.5">
          {pipelineStages.map((stage, i) => (
            <PipelineStage key={stage.name} {...stage} index={i} />
          ))}
        </div>

        {/* Full CI log */}
        <Card className="border-border/40 bg-card mt-8 overflow-hidden">
          <div className="border-b border-border/40 bg-secondary/20 px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">context-ci.log</span>
            <span className="text-[10px] text-muted-foreground">11 entries</span>
          </div>
          <pre className="p-4 text-[11px] font-mono text-muted-foreground leading-[1.8] overflow-x-auto">
{`[2026-05-16T10:00:00Z] SUBMIT  secure-code-review.md by SecureAI Contributors
[2026-05-16T10:00:00Z] PASS    Schema validation: 12/12 required fields present
[2026-05-16T10:00:01Z] PASS    Structure lint: 6/6 required, 2/3 recommended sections
[2026-05-16T10:00:02Z] PASS    Safety scan: 0 injections, 0 unsafe, 0 PII, 0 encoded
[2026-05-16T10:00:04Z] PASS    Copyright: 2.1% similarity (threshold: 15%)
[2026-05-16T10:00:05Z] WARN    Token efficiency: 5,100/6,000 (85%) — above recommended
[2026-05-16T10:00:08Z] PASS    Contradiction scan: 0/47 rules contradictory
[2026-05-16T10:00:21Z] PASS    Benchmark: +38% specificity, +42% compliance (5 agents)
[2026-05-18T14:00:00Z] PASS    Human review: Marcus Webb (Security Reviewer, Rep: 95)
[2026-05-18T14:32:00Z] RELEASE Digest sha256:c9d1e2f4a7b85c3d — Ed25519 signing planned (Sigstore) — published v1.2.0
[2026-05-18T14:32:01Z] INDEX   Registry updated. Attestation cci-v1 recorded.`}
          </pre>
        </Card>
      </div>
    </main>
  )
}

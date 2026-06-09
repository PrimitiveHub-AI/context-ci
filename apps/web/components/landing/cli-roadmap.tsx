import { Terminal } from "lucide-react"

const commands = [
  {
    cmd: "phub validate ./secure-code-review.md",
    label: "Local validation",
    description:
      "Run schema, structure, safety, token, and contradiction scanners locally. No network. Same code as Context CI.",
    output: `Running 7 scanners against secure-code-review.md
[PASS] schema-validation              13/13 fields, 312ms
[PASS] structure-lint                 6/6 required sections, 821ms
[PASS] safety-scan                    0 findings T1-T6, 1184ms
[WARN] token-efficiency               5,100 / 6,000 (85%), TOK-DENSITY-HIGH
[PASS] contradiction-detection        0/47 contradictory, 3.1s
ready for submit · 1 warning`,
  },
  {
    cmd: "phub publish ./secure-code-review.md",
    label: "Sign + submit",
    description:
      "Compute content digest, exchange OIDC token at Fulcio, sign attestation, record in Rekor, submit to the registry.",
    output: `Authenticating via OIDC ……………… mhm@cyberorca.sa
Content digest …………………………………… sha256:c9d1e2f4…
Fulcio cert issued ………………………… valid 10m
DSSE envelope signed ………………………… Ed25519
Rekor entry ID …………………………………… 24296fb24b8ad77a…
Submitted to public registry ……… v1.2.0 (Submitted → Context CI)`,
  },
  {
    cmd: "phub install strict-code-review@2.1.0",
    label: "Install + verify",
    description:
      "Resolve, fetch from content-addressed storage, re-hash, verify Rekor inclusion, write to the agent's context directory.",
    output: `Resolving strict-code-review@2.1.0 …………… sha256:b7e4f1a9…
Fetched 3,800 tokens · CC-BY-4.0
Re-hash matches digest …………………………… OK
Rekor inclusion proof verified ………………… OK
Attestation verdict: Trusted (94/99/87/91)
Installed → ~/.config/agents/primitives/`,
  },
]

export function CLIRoadmap() {
  return (
    <section className="border-b border-border/40 py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.04] px-3 py-1 mb-4">
            <Terminal className="size-3 text-primary/80" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-primary/80">
              CLI · planned for v1
            </span>
          </div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
            Validate locally. Publish signed. Install verified.
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            <code className="font-mono text-foreground/80">phub</code> is the
            open-source CLI for PrimitiveHub. The same scanner that runs in
            Context CI runs on your machine — what passes locally passes on
            submit, no surprises.
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-4xl space-y-3">
          {commands.map((c) => (
            <div
              key={c.cmd}
              className="rounded-xl border border-border/40 bg-card overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border/40 bg-secondary/20 px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-primary/60 select-none">$</span>
                  <code className="text-xs font-mono text-foreground/90">{c.cmd}</code>
                </div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">
                  {c.label}
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {c.description}
                </p>
                <pre className="rounded-md bg-background/60 border border-border/30 px-3 py-2 text-[10.5px] font-mono text-muted-foreground/90 leading-[1.7] overflow-x-auto whitespace-pre">
{c.output}
                </pre>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[10px] font-mono text-muted-foreground/60">
          phub will be released as Apache-2.0 alongside the public PrimitiveHub launch.
        </p>
      </div>
    </section>
  )
}

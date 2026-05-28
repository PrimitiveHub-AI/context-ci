import { Card } from "@/components/ui/card"
import { ShieldAlert, UserPlus, BadgeCheck, Eye, ShieldCheck, Wrench, Building2 } from "lucide-react"

const roles = [
  {
    name: "Author",
    icon: UserPlus,
    color: "border-amber/25 bg-amber/[0.06] text-amber/85",
    iconColor: "text-amber/85",
    permissions: [
      "Submit primitives to public registries",
      "Author within their own private workspace",
      "Respond to reviewer comments",
    ],
    constraint: "Cannot self-approve. All submissions enter Context CI + human review.",
  },
  {
    name: "Verified Expert",
    icon: BadgeCheck,
    color: "border-success/25 bg-success/[0.06] text-success/85",
    iconColor: "text-success/85",
    permissions: [
      "All Author permissions",
      "Domain-verified credential displayed on authored primitives",
      "Eligible for accelerated review on in-domain submissions",
    ],
    constraint: "Verification is granted by Maintainers and revocable on conflict of interest.",
  },
  {
    name: "Reviewer",
    icon: Eye,
    color: "border-primary/25 bg-primary/[0.06] text-primary/85",
    iconColor: "text-primary/85",
    permissions: [
      "Review submissions assigned by the queue",
      "Approve, request changes, or reject",
      "Reputation score visible on every review",
    ],
    constraint: "Cannot review primitives they authored or co-authored.",
  },
  {
    name: "Security Reviewer",
    icon: ShieldCheck,
    color: "border-destructive/25 bg-destructive/[0.06] text-destructive/85",
    iconColor: "text-destructive/85",
    permissions: [
      "All Reviewer permissions",
      "Required approver for any primitive with risk_level: high",
      "Required approver for security/* type primitives",
    ],
    constraint: "Independent of the registry operator. Audit logs published per release cycle.",
  },
  {
    name: "Maintainer",
    icon: Wrench,
    color: "border-violet/25 bg-violet/[0.06] text-violet/85",
    iconColor: "text-violet/85",
    permissions: [
      "Set policy for a registry or repository",
      "Promote Authors to Verified Expert",
      "Withdraw or deprecate primitives",
      "Define allowlist / denylist for org-scoped registries",
    ],
    constraint: "Tenant-scoped — a maintainer in Org A holds no authority in Org B.",
  },
  {
    name: "Registry Admin",
    icon: Building2,
    color: "border-muted-foreground/30 bg-secondary/40 text-foreground/85",
    iconColor: "text-foreground/70",
    permissions: [
      "Operate the registry itself",
      "Cryptographic key custody (or KMS delegation)",
      "Outage response, capacity, infrastructure",
    ],
    constraint: "Cannot bypass Context CI. Cannot retroactively modify signed attestations.",
  },
]

export function GovernanceSection() {
  return (
    <div className="border-b border-border/40">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
            Governance
          </p>
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            Roles, responsibilities, and what they each cannot do
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Six roles with bounded authority. Each role's permissions are
            documented; each role's constraints are documented; every
            consequential action lands in the audit log with a bound OIDC
            identity. Tenants in private deployments inherit this model with
            their own role assignments.
          </p>
        </div>

        {/* Public-uploads disclosure — the most important sentence on the page */}
        <Card className="border-amber/30 bg-amber/[0.04] p-4 mb-6 flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber/15 mt-0.5">
            <ShieldAlert className="size-4 text-amber" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Public uploads are not automatically trusted.
            </p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Every public submission enters Context CI, then enters human
              review by a Reviewer (and a Security Reviewer if the primitive's
              risk level or type warrants it). A primitive is{" "}
              <span className="font-mono text-foreground/80">Trusted</span>{" "}
              only after both passes complete. There is no shortcut path,
              including for accounts with prior trusted releases.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const Icon = role.icon
            return (
              <Card key={role.name} className="border-border/40 bg-card p-4 flex flex-col">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className={`flex size-8 items-center justify-center rounded-md border ${role.color}`}>
                    <Icon className={`size-3.5 ${role.iconColor}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{role.name}</h3>
                </div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-2">
                  Can
                </p>
                <ul className="space-y-1.5 mb-3">
                  {role.permissions.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1.5 mt-auto pt-2 border-t border-border/30">
                  Cannot
                </p>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic">
                  {role.constraint}
                </p>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GovernanceSection } from "@/components/contributors/governance-section"
import { useContributors, useReviews } from "@/lib/api/queries"
import { reviewQueue as mockReviews } from "@/lib/data/reviews"
import { contributors as mockContributors } from "@/lib/data/contributors"
import type { Contributor, ReviewItem } from "@/lib/types"
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  User,
  Star,
  Calendar,
  FileText,
  Shield,
} from "lucide-react"

const roleColors: Record<string, string> = {
  Maintainer: "border-primary/20 bg-primary/[0.06] text-primary",
  "Verified Expert": "border-success/20 bg-success/[0.06] text-success",
  Author: "border-amber/20 bg-amber/[0.06] text-amber",
  Reviewer: "border-muted-foreground/20 bg-muted text-muted-foreground",
  "Security Reviewer": "border-destructive/20 bg-destructive/[0.06] text-destructive",
}

const statusIcons: Record<string, { icon: React.ElementType; color: string }> = {
  "Needs Security Review": { icon: ShieldCheck, color: "text-destructive" },
  "Benchmark Failed": { icon: XCircle, color: "text-destructive" },
  "Human Review Pending": { icon: Clock, color: "text-amber" },
  Approved: { icon: CheckCircle2, color: "text-success" },
  Rejected: { icon: XCircle, color: "text-destructive" },
}

export default function ContributorsPage() {
  const [tab, setTab] = useState<"queue" | "contributors">("queue")
  const reviewsQuery = useReviews()
  const contributorsQuery = useContributors()
  const reviewQueue: ReviewItem[] =
    reviewsQuery.data ?? (reviewsQuery.isError ? mockReviews : [])
  const contributorsData: Contributor[] =
    contributorsQuery.data ?? (contributorsQuery.isError ? mockContributors : [])
  const apiDegraded = reviewsQuery.isError || contributorsQuery.isError

  return (
    <main className="min-h-screen">
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary mb-2">
            Expert Reviewers
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Review & Contributor Dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl leading-relaxed">
            Every trusted primitive is reviewed by domain experts with verified credentials
            and measurable reputation scores. Manage submissions, track review status, and
            view reviewer authority. Trust is earned through consistent, high-quality expert reviews.
          </p>
        </div>
      </div>

      {/* Governance — roles, responsibilities, public-uploads disclosure */}
      <GovernanceSection />

      {/* Tab toggle */}
      <div className="border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex gap-0">
            {[
              { key: "queue" as const, label: "Review Queue", count: reviewQueue.filter((r) => r.status !== "Approved").length },
              { key: "contributors" as const, label: "Contributors", count: contributorsData.length },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3 text-[13px] transition-colors ${
                  tab === t.key
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <span className="text-[9px] font-mono text-muted-foreground bg-secondary rounded-sm px-1 py-0.5">
                  {t.count}
                </span>
                {tab === t.key && (
                  <span className="absolute bottom-0 left-1/2 h-px w-6 -translate-x-1/2 bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {apiDegraded && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-amber">
            <AlertCircle className="size-3" />
            api unreachable — showing cached/demo data
          </div>
        )}
        {tab === "queue" && (
          <div className="space-y-2.5">
            {reviewQueue.map((item) => {
              const statusConfig = statusIcons[item.status]
              const StatusIcon = statusConfig?.icon || AlertTriangle

              return (
                <Card key={item.primitive} className="border-border/40 bg-card p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <StatusIcon className={`size-3.5 ${statusConfig?.color || "text-muted-foreground"}`} />
                        <span className="text-sm font-mono font-medium text-foreground">
                          {item.primitive}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono border-border/40 text-muted-foreground h-4">
                          v{item.version}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] font-mono h-4 gap-0.5 ${
                          item.riskLevel === "low" ? "border-success/20 text-success" :
                          item.riskLevel === "medium" ? "border-amber/20 text-amber" :
                          "border-destructive/20 text-destructive"
                        }`}>
                          <Shield className="size-2" />
                          {item.riskLevel}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-2.5" />
                          {item.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-2.5" />
                          {item.submittedAt}
                        </span>
                        {item.reviewer && (
                          <span>
                            Reviewer: <span className="text-foreground/70">{item.reviewer}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MessageSquare className="size-2.5" />
                          {item.comments}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          item.status === "Approved"
                            ? "border-success/20 text-success"
                            : item.status === "Benchmark Failed" ||
                                item.status === "Needs Security Review"
                              ? "border-destructive/20 text-destructive"
                              : "border-amber/20 text-amber"
                        }`}
                      >
                        {item.status}
                      </Badge>
                      {item.status !== "Approved" && item.status !== "Rejected" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] border-success/20 text-success hover:bg-success/[0.06] px-2"
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] border-destructive/20 text-destructive hover:bg-destructive/[0.06] px-2"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {tab === "contributors" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contributorsData.map((contributor) => (
              <Card key={contributor.name} className="border-border/40 bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {contributor.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {contributor.name}
                    </h3>
                    <Badge
                      variant="outline"
                      className={`mt-1 text-[9px] font-mono h-4 ${roleColors[contributor.role] || "border-border text-muted-foreground"}`}
                    >
                      {contributor.role}
                    </Badge>
                    <p className="mt-2 text-[10px] text-muted-foreground">{contributor.specialization}</p>
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="size-2.5 text-amber/70" />
                        <span className="font-mono text-foreground/70">{contributor.reputation}</span>
                      </span>
                      {contributor.primitives > 0 && (
                        <span className="flex items-center gap-1">
                          <FileText className="size-2.5" />
                          {contributor.primitives}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-2.5" />
                        {contributor.reviews} reviews
                      </span>
                    </div>
                    <p className="mt-1.5 text-[9px] text-muted-foreground/60 font-mono">
                      Joined {contributor.joinedAt}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

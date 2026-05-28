export type TrustStatus = "Trusted" | "In Review" | "Experimental" | "Deprecated"

export type Category =
  | "Software Engineering"
  | "Product Design"
  | "Cybersecurity"
  | "Research & Writing"
  | "Architecture"
  | "Performance"
  | "Agent Behavior"
  | "Domain Expertise"

export type CompatibleAgent =
  | "Claude Code"
  | "Cursor"
  | "Codex"
  | "Copilot"
  | "v0"
  | "Windsurf"

export type RiskLevel = "low" | "medium" | "high"

export type ContributorRole =
  | "Maintainer"
  | "Verified Expert"
  | "Author"
  | "Reviewer"
  | "Security Reviewer"

export type ReviewStatus =
  | "Needs Security Review"
  | "Benchmark Failed"
  | "Human Review Pending"
  | "Approved"
  | "Rejected"

export type PipelineStageStatus = "passed" | "warning" | "failed"

export interface Primitive {
  slug: string
  name: string
  fileName: string
  category: Category
  description: string
  author: string
  version: string
  tokens: number
  tokenBudget: number
  qualityScore: number
  safetyScore: number
  contextEfficiency: number
  agentImpact: number
  status: TrustStatus
  compatibleAgents: CompatibleAgent[]
  license: string
  lastUpdated: string
  useWhen: string[]
  doNotUseWhen: string[]
  riskLevel: RiskLevel
  contentDigest: string
  installCommand: string
  downloads: number
  reviewerBadge?: string
}

export interface Bundle {
  slug: string
  name: string
  description: string
  primitives: string[]
  totalTokens: number
  totalBudget: number
  compatibleAgents: CompatibleAgent[]
  qualityAverage: number
  useCase: string
  installCommand: string
  downloads: number
}

export interface ReviewItem {
  primitive: string
  author: string
  status: ReviewStatus
  reviewer?: string
  submittedAt: string
  comments: number
  version: string
  riskLevel: RiskLevel
}

export interface Contributor {
  name: string
  role: ContributorRole
  primitives: number
  reviews: number
  reputation: number
  avatar: string
  joinedAt: string
  specialization: string
}

export interface PipelineStage {
  name: string
  status: PipelineStageStatus
  score: number
  duration: string
  log: string
  reviewer: string
}

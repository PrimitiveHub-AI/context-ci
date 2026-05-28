import type { ReviewItem } from "@/lib/types"

export const reviewQueue: ReviewItem[] = [
  {
    primitive: "agent-anti-hallucination.md",
    author: "PrimitiveHub Labs",
    status: "Needs Security Review",
    submittedAt: "2026-05-24",
    comments: 3,
    version: "1.4.0",
    riskLevel: "medium",
  },
  {
    primitive: "react-performance-engineering.md",
    author: "PrimitiveHub Labs",
    status: "Benchmark Failed",
    reviewer: "Sarah Chen",
    submittedAt: "2026-05-21",
    comments: 7,
    version: "2.0.0",
    riskLevel: "low",
  },
  {
    primitive: "threat-modeling.md",
    author: "SecureAI Contributors",
    status: "Human Review Pending",
    reviewer: "Marcus Webb",
    submittedAt: "2026-05-19",
    comments: 2,
    version: "1.1.0",
    riskLevel: "low",
  },
  {
    primitive: "clean-code.md",
    author: "Django Experts Guild",
    status: "Approved",
    reviewer: "Ava Reyes",
    submittedAt: "2026-05-15",
    comments: 5,
    version: "1.0.0",
    riskLevel: "low",
  },
]

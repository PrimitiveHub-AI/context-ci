"""Seed-data fixture for the dev/test registry.

A representative subset (not a row-for-row mirror of `apps/web/lib/data/
primitives.ts`) that exercises every code path the API surface can take:

  - Every TrustStatus → Verdict mapping (Trusted, In Review, Experimental,
    Deprecated)
  - Every RiskLevel (low / medium / high)
  - Multiple categories
  - Compatible-agent filter scenarios (some primitives compat with all
    agents, others with a subset)
  - One primitive with an attestation, one without (for /attestation 404
    path)

Drift control: `tests/test_parity.py` asserts that every category referenced
in the web data file maps to a `Primitive.Category` value, and every
TrustStatus literal maps to a Verdict. The fixture does NOT need to grow
when the web data grows — production data lands via the upload endpoint in
Step 3.
"""

from __future__ import annotations

from typing import Any, TypedDict


class PrimitiveFixture(TypedDict):
    slug: str
    name: str
    description: str
    category: str
    risk_level: str
    repository_slug: str
    version: dict[str, Any]


SEED_ORG_SLUG = "primitivehub-labs"
SEED_ORG_NAME = "PrimitiveHub Labs"
SEED_REGISTRY_SLUG = "public"
SEED_REGISTRY_NAME = "Public Registry"


SEED_REPOSITORIES: list[dict[str, str]] = [
    {"slug": "frontend", "name": "Frontend", "description": "UI + design primitives."},
    {
        "slug": "engineering",
        "name": "Engineering",
        "description": "Code + architecture primitives.",
    },
    {
        "slug": "security",
        "name": "Security",
        "description": "Supply-chain + threat-model primitives.",
    },
]


SEED_PRIMITIVES: list[PrimitiveFixture] = [
    {
        "slug": "frontend-design-elite",
        "name": "Frontend Design Elite",
        "description": "Taste-calibrated UI doctrine for serious infrastructure surfaces.",
        "category": "product-design",
        "risk_level": "low",
        "repository_slug": "frontend",
        "version": {
            "semver": "0.2.0",
            "tokens": 3800,
            "token_budget": 5000,
            "license": "CC-BY-4.0",
            "verdict": "trusted",
            "quality_score": 96,
            "safety_score": 98,
            "efficiency_score": 91,
            "impact_score": 94,
            "compatible_agents": ["Claude Code", "Cursor", "Codex", "v0"],
            "use_when": ["Making any visual decision in the PrimitiveHub frontend"],
            "do_not_use_when": ["Backend API design", "Legal writing"],
            "has_attestation": True,
        },
    },
    {
        "slug": "tailwind-v4-mastery",
        "name": "Tailwind v4 Mastery",
        "description": "CSS-first config, OKLCH tokens, @theme inline, dark-first defaults.",
        "category": "software-engineering",
        "risk_level": "low",
        "repository_slug": "frontend",
        "version": {
            "semver": "0.2.0",
            "tokens": 3900,
            "token_budget": 5000,
            "license": "CC-BY-4.0",
            "verdict": "trusted",
            "quality_score": 94,
            "safety_score": 97,
            "efficiency_score": 92,
            "impact_score": 93,
            "compatible_agents": ["Claude Code", "Cursor", "Codex", "Copilot", "v0", "Windsurf"],
            "use_when": ["Writing or modifying Tailwind v4 styles"],
            "do_not_use_when": ["Tailwind v3 codebases"],
            "has_attestation": True,
        },
    },
    {
        "slug": "django-ninja-production",
        "name": "Django Ninja Production",
        "description": "Production patterns for the apps/api Django + Ninja + Postgres backend.",
        "category": "software-engineering",
        "risk_level": "medium",
        "repository_slug": "engineering",
        "version": {
            "semver": "0.1.0",
            "tokens": 4200,
            "token_budget": 6000,
            "license": "CC-BY-4.0",
            "verdict": "in_review",
            "quality_score": 90,
            "safety_score": 95,
            "efficiency_score": 88,
            "impact_score": 91,
            "compatible_agents": ["Claude Code", "Cursor", "Codex", "Copilot"],
            "use_when": ["Adding or modifying any file in apps/api/"],
            "do_not_use_when": ["Frontend or design work"],
            "has_attestation": False,
        },
    },
    {
        "slug": "security-engineering-supplychain",
        "name": "Security Engineering: Supply Chain",
        "description": "Ross Anderson-distilled supply-chain security for the registry.",
        "category": "cybersecurity",
        "risk_level": "high",
        "repository_slug": "security",
        "version": {
            "semver": "0.1.0",
            "tokens": 4800,
            "token_budget": 6000,
            "license": "CC-BY-4.0",
            "verdict": "experimental",
            "quality_score": 92,
            "safety_score": 99,
            "efficiency_score": 85,
            "impact_score": 97,
            "compatible_agents": ["Claude Code"],
            "use_when": ["Anything touching attestation, signing, key handling"],
            "do_not_use_when": ["Pure frontend work"],
            "has_attestation": True,
        },
    },
    {
        "slug": "legacy-stub",
        "name": "Legacy Stub",
        "description": "Deprecated example used to exercise the deprecated path in API tests.",
        "category": "software-engineering",
        "risk_level": "low",
        "repository_slug": "engineering",
        "version": {
            "semver": "0.0.1",
            "tokens": 800,
            "token_budget": 1000,
            "license": "MIT",
            "verdict": "deprecated",
            "quality_score": 70,
            "safety_score": 80,
            "efficiency_score": 75,
            "impact_score": 60,
            "compatible_agents": ["Claude Code"],
            "use_when": [],
            "do_not_use_when": ["Anything; this is a deprecated stub"],
            "has_attestation": False,
        },
    },
]

"""T7 — Poisoned naming / typosquatting / impersonation.

The threat model: a primitive whose body claims an affiliation it
doesn't have, or names a well-known vendor in a way that suggests
endorsement. The agent reads the prose and treats the primitive as
"official" — the impersonation attack succeeds.

What this detector flags (v0.1, content-only)
---------------------------------------------

  official-vendor-claim
    Prose like "official Anthropic skill", "the OpenAI team's
    primitive", "Google's recommended prompt". A primitive can be
    inspired by a vendor's work; it cannot claim to BE the vendor's
    work without paid-for evidence (Sigstore identity cert from the
    vendor's OIDC issuer).

  false-affiliation-claim
    "Endorsed by Stripe", "certified by GitHub", "as featured by
    Cloudflare". Same shape as official-vendor-claim with a
    different verb.

  vendor-typosquat
    Visually-similar misspellings of trusted-vendor names:
    "Anthrop1c", "0penAI", "G0ogle", "Mlcrosoft" (with one zero/
    digit for an O/I). v0.1 catches the obvious digit-for-letter
    substitutions; Cyrillic / mixed-script confusables overlap with
    T2's mixed-script detector and are flagged by both per the
    Top 10 spec's also-fires convention.

What v0.1 does NOT do
---------------------

Slug-similarity (Levenshtein vs. the registry catalog) and Sigstore
identity cross-checks need DetectorContext to carry slug + cert
chain. That extension is v0.2.

Known false positives
---------------------

A primitive teaching how to integrate with a vendor SDK will
legitimately mention the vendor by name. T7's prose patterns are
narrow enough (verb-phrase shapes, not bare mentions) that this is
acceptable v0.1 noise.
"""

from __future__ import annotations

import re

from .types import DetectorContext, DiffHint, Severity, Verdict

# Well-known AI / cloud / dev vendors. The detector flags impersonation
# claims tied to ANY of these. v0.1 keeps the list short; v0.2 widens.
_VENDORS: tuple[str, ...] = (
    "Anthropic",
    "OpenAI",
    "Google",
    "Microsoft",
    "Meta",
    "Apple",
    "Amazon",
    "AWS",
    "GitHub",
    "GitLab",
    "Bitbucket",
    "Vercel",
    "Netlify",
    "Cloudflare",
    "Stripe",
    "Auth0",
    "Okta",
    "LangChain",
    "LlamaIndex",
    "Hugging Face",
    "HuggingFace",
    "Pinecone",
    "Weaviate",
    "Cursor",
    "Aider",
    "Cline",
    "Continue",
    "MongoDB",
    "Supabase",
    "PostgreSQL",
    "Postgres",
    "Snowflake",
    "Databricks",
    "Datadog",
    "Sentry",
    "PagerDuty",
)
_VENDOR_ALT = "|".join(re.escape(v) for v in _VENDORS)

# Typosquats: digit-for-letter substitutions that produce visually
# similar names. Capture each suspicious form as a literal regex.
_TYPOSQUAT_PATTERNS = (
    r"\bAnthrop1c\b",
    r"\b[A4O0]nthropic\b",
    r"\b0penAI\b",
    r"\b0pen[Aa][Ii]\b",
    r"\bOp3nAI\b",
    r"\bG0ogle\b",
    r"\bGo0gle\b",
    r"\bGoog1e\b",
    r"\bM1crosoft\b",
    r"\bMlcrosoft\b",
    r"\bM[i1l]crosoft\b",
    r"\bClaud3\b",
    r"\bGPT4-?official\b",
    r"\bM3ta\b",
    r"\b[O0]kta\b(?!\w)",
    r"\bSt[r1]ipe\b",
)

_OFFICIAL_CLAIM_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        rf"\b(?:the\s+)?official\s+(?:{_VENDOR_ALT})\s+(?:primitive|skill|tool|prompt|agent|integration|sdk)",
        "official-vendor-claim",
    ),
    (
        rf"\bthis\s+is\s+(?:the\s+)?official\s+(?:{_VENDOR_ALT})\b",
        "official-vendor-claim",
    ),
    (
        rf"\bfrom\s+the\s+(?:{_VENDOR_ALT})\s+team\b",
        "official-vendor-claim",
    ),
    (
        rf"\b(?:{_VENDOR_ALT})'s\s+(?:official|recommended|certified|endorsed)\s+(?:primitive|skill|tool|prompt|agent|integration|sdk)",
        "official-vendor-claim",
    ),
)

_FALSE_AFFILIATION_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        rf"\b(?:endorsed|certified|approved|sanctioned|verified)\s+by\s+(?:{_VENDOR_ALT})\b",
        "false-affiliation-claim",
    ),
    (
        rf"\bas\s+(?:featured|recommended|adopted)\s+by\s+(?:{_VENDOR_ALT})\b",
        "false-affiliation-claim",
    ),
    (
        rf"\bin\s+partnership\s+with\s+(?:{_VENDOR_ALT})\b",
        "false-affiliation-claim",
    ),
)

_TYPOSQUAT_TUPLES: tuple[tuple[str, str], ...] = tuple(
    (pat, "vendor-typosquat") for pat in _TYPOSQUAT_PATTERNS
)

_ALL_PATTERNS = (
    _OFFICIAL_CLAIM_PATTERNS + _FALSE_AFFILIATION_PATTERNS + _TYPOSQUAT_TUPLES
)

_COMPILED = tuple(
    (re.compile(pattern, re.IGNORECASE | re.MULTILINE), tag) for pattern, tag in _ALL_PATTERNS
)

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


def _hint_for_match(content: str, match: re.Match[str], tag: str) -> DiffHint:
    line_no = content.count("\n", 0, match.start()) + 1
    raw = match.group(0)
    snippet = raw[:_SNIPPET_MAX_CHARS] + ("…" if len(raw) > _SNIPPET_MAX_CHARS else "")
    suggestion_map = {
        "official-vendor-claim": (
            "Prose claims this primitive is the official work of a named vendor. "
            "Real vendor affiliations are proven via Sigstore identity attestations, "
            "not text. Rephrase as 'inspired by' / 'integrates with' / 'works with', "
            "or, if the claim is real, sign the bundle with the vendor's identity cert."
        ),
        "false-affiliation-claim": (
            "Prose asserts endorsement/certification by a named vendor. Same fix as "
            "above — drop the claim or back it with an attestation chain."
        ),
        "vendor-typosquat": (
            "Vendor name appears typosquatted (digit-for-letter or near-confusable). "
            "If accidental, fix the spelling. If deliberate, this is impersonation."
        ),
    }
    return DiffHint(
        line=line_no,
        snippet=snippet,
        suggestion=suggestion_map.get(tag, "Impersonation pattern matched."),
        detail_tag=tag,
    )


class T7PoisonedNamingDetector:
    """Concrete `Detector` for T7. Stateless; pre-compiled regex pool."""

    name = "t7.poisoned_naming"
    threat_category = "T7"
    cci_id = "CCI-007"
    detector_version = "0.1.0"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                hints.append(_hint_for_match(ctx.content, match, tag))
                if len(hints) >= _MAX_HINTS_PER_VERDICT:
                    break
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="No poisoned-naming patterns matched.",
                detector_version=self.detector_version,
            )

        plural = "s" if len(hints) != 1 else ""
        return Verdict(
            detector_name=self.name,
            threat_category=self.threat_category,
            cci_id=self.cci_id,
            severity=Severity.FAIL,
            passed=False,
            summary=(
                f"Matched {len(hints)} poisoned-naming pattern{plural}; "
                "impersonation / typosquat claim detected."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )

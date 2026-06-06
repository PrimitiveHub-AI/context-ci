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

from .markdown_context import (
    analyze_markdown_context,
    is_in_frontmatter,
    is_in_inline_code,
)
from .semantic_context import is_in_mention_context
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
# similar names. Each pattern must EXCLUDE the canonical letter — the
# detector is meant to catch IMITATIONS, not bare mentions. v0.2.3
# (2026-06-04) fixed character classes that accidentally included the
# canonical letter and were firing on every legitimate vendor mention
# (e.g. `[A4O0]nthropic` matched "Anthropic" itself, `[O0]kta` matched
# "Okta", `M[i1l]crosoft` matched "Microsoft").
_TYPOSQUAT_PATTERNS = (
    r"\bAnthrop1c\b",            # 1-for-i in Anthropic
    r"\b4nthropic\b",            # 4-for-A in Anthropic
    r"\b0nthropic\b",            # 0-for-A (debatable but distinctive)
    r"\b0penAI\b",               # 0-for-O in OpenAI
    r"\b0pen[Aa][Ii]\b",         # 0-for-O + casing variants
    r"\bOp3nAI\b",               # 3-for-e in OpenAI
    r"\bG0ogle\b",               # 0-for-o in Google (first o)
    r"\bGo0gle\b",               # 0-for-o in Google (second o)
    r"\bGoog1e\b",               # 1-for-l in Google
    r"\bM1crosoft\b",            # 1-for-i in Microsoft
    r"\bMlcrosoft\b",            # l-for-i in Microsoft (visual confusable)
    r"\bClaud3\b",               # 3-for-e in Claude
    r"\bGPT4-?official\b",       # GPT4-official impersonation
    r"\bM3ta\b",                 # 3-for-e in Meta
    r"\b0kta\b(?!\w)",           # 0-for-O in Okta
    r"\bSt1ipe\b",               # 1-for-r in Stripe (visually weak; kept for symmetry)
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

# v0.2.4 (Round 6 fix 3 — closes FN-011): Unicode-confusable patterns
# for known vendor names. Mixes the canonical Latin letter with its
# commonly-substituted Cyrillic / Greek confusable; matches the "any
# non-ASCII letter is present in the canonical-Latin slot" sense and
# fires `vendor-homoglyph`. ASCII-only renders (no confusable used)
# DON'T match — the bare-Latin word is the vendor's REAL name and
# isn't impersonation.
#
# Boundary defense: ``(?<![A-Za-z0-9_])`` / ``(?![A-Za-z0-9_])`` are
# used instead of ``\b`` because ``\b`` is ASCII-only by default and
# a Cyrillic letter at the boundary doesn't trigger it.
#
# Vendor-list-first scope: Anthropic + OpenAI. A generic NFKC + script-
# mixing detector is the planned Round 7+ generalisation.
_HOMOGLYPH_VENDOR_PATTERNS: tuple[str, ...] = (
    # Anthropic: Cyrillic А (U+0410) or а (U+0430) instead of Latin A/a.
    r"(?<![A-Za-z0-9_])[Аа]nthropic(?![A-Za-z0-9_])",
    # OpenAI: Cyrillic О (U+041E) or о (U+043E) instead of Latin O/o.
    r"(?<![A-Za-z0-9_])[Оо]pen[Aa][Ii](?![A-Za-z0-9_])",
)

_HOMOGLYPH_TUPLES: tuple[tuple[str, str], ...] = tuple(
    (pat, "vendor-homoglyph") for pat in _HOMOGLYPH_VENDOR_PATTERNS
)

_ALL_PATTERNS = (
    _OFFICIAL_CLAIM_PATTERNS
    + _FALSE_AFFILIATION_PATTERNS
    + _TYPOSQUAT_TUPLES
    + _HOMOGLYPH_TUPLES
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
        "vendor-homoglyph": (
            "Vendor name appears with a non-ASCII letter visually identical to the "
            "canonical Latin spelling (Cyrillic / Greek confusable). This is the "
            "classic visual-impersonation shape and never benign in primitive content. "
            'If this is a foreign-language reference, use the language\'s native '
            'spelling (e.g. "Антропик") rather than a mixed-script form.'
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
    detector_version = "0.2.4"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        # v0.2.1 (ADR-0035): skip matches inside frontmatter.
        # v0.2.2 (ADR-0036): for the bare-vendor-name typosquat family
        # only, also skip matches in mention context — "Stripe's
        # typography" and "like Linear" are references, not
        # impersonation. OFFICIAL_CLAIM + FALSE_AFFILIATION patterns
        # remain context-unaware because they're explicit impersonation
        # prose.
        md_ctx = analyze_markdown_context(ctx.content)

        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                if is_in_frontmatter(match.start(), md_ctx) or is_in_inline_code(match.start(), md_ctx):
                    continue
                if tag in {"vendor-typosquat", "vendor-homoglyph"} and is_in_mention_context(
                    ctx.content, match.start(), match.end()
                ):
                    continue
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

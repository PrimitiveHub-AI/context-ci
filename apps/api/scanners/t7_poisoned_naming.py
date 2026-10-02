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
    # v0.3.1 (Round 10 PR 10.2 — closes FN-015): AI-coding-tool vendors
    # currently outside the curated list. Each addition automatically
    # extends BOTH the official-vendor-claim / false-affiliation /
    # vendor-typosquat regex families AND the v0.3.0 generic
    # homoglyph skeleton check; no per-vendor pattern authoring needed.
    # Lockstep with packages/phub/src/scanners/t7-poisoned-naming.ts § v0.3.1.
    "Replit",
    "Glitch",
    "StackBlitz",
    "Codespaces",
    "Bolt",
    "Lovable",
    "Cody",
    "Sourcegraph",
)
_VENDOR_ALT = "|".join(re.escape(v) for v in _VENDORS)

# v0.3.2 (Round 13 PR 13.2 — closes FN-023 on S-119 "official
# ua-parser-js primitive"): curated list of high-trust npm + PyPI
# packages whose names are common impersonation targets. Distinct
# from `_VENDORS` (which holds vendor BRAND names like Anthropic /
# Google); packages are the SPECIFIC PUBLISHED ARTIFACTS that
# attackers impersonate by writing "the official <package-name>
# primitive endorsed by the <package-name> maintainer team." The
# eslint-config-prettier (2024) and ua-parser-js (2021) incidents
# both followed this shape. Lockstep with packages/phub/src/
# scanners/t7-poisoned-naming.ts § v0.3.2.
_HIGH_TRUST_PACKAGES: tuple[str, ...] = (
    # npm — most-downloaded utility packages historically used as
    # typosquat / maintainer-compromise vectors
    "lodash",
    "express",
    "react",
    "vue",
    "axios",
    "dotenv",
    "ua-parser-js",
    "eslint",
    "prettier",
    "webpack",
    "vite",
    "next",
    "nuxt",
    "babel",
    "rollup",
    "tailwindcss",
    "svelte",
    "moment",
    "jquery",
    "underscore",
    # PyPI — high-trust packages with known supply-chain incidents
    "requests",
    "urllib3",
    "numpy",
    "pandas",
    "django",
    "flask",
    "pytest",
    "sqlalchemy",
    "pyyaml",
    "setuptools",
)
_HIGH_TRUST_PACKAGE_ALT = "|".join(re.escape(p) for p in _HIGH_TRUST_PACKAGES)

# Typosquats: digit-for-letter substitutions that produce visually
# similar names. Each pattern must EXCLUDE the canonical letter — the
# detector is meant to catch IMITATIONS, not bare mentions. v0.2.3
# (2026-06-04) fixed character classes that accidentally included the
# canonical letter and were firing on every legitimate vendor mention
# (e.g. `[A4O0]nthropic` matched "Anthropic" itself, `[O0]kta` matched
# "Okta", `M[i1l]crosoft` matched "Microsoft").
_TYPOSQUAT_PATTERNS = (
    r"\bAnthrop1c\b",  # 1-for-i in Anthropic
    r"\b4nthropic\b",  # 4-for-A in Anthropic
    r"\b0nthropic\b",  # 0-for-A (debatable but distinctive)
    r"\b0penAI\b",  # 0-for-O in OpenAI
    r"\b0pen[Aa][Ii]\b",  # 0-for-O + casing variants
    r"\bOp3nAI\b",  # 3-for-e in OpenAI
    r"\bG0ogle\b",  # 0-for-o in Google (first o)
    r"\bGo0gle\b",  # 0-for-o in Google (second o)
    r"\bGoog1e\b",  # 1-for-l in Google
    r"\bM1crosoft\b",  # 1-for-i in Microsoft
    r"\bMlcrosoft\b",  # l-for-i in Microsoft (visual confusable)
    r"\bClaud3\b",  # 3-for-e in Claude
    r"\bGPT4-?official\b",  # GPT4-official impersonation
    r"\bM3ta\b",  # 3-for-e in Meta
    r"\b0kta\b(?!\w)",  # 0-for-O in Okta
    r"\bSt1ipe\b",  # 1-for-r in Stripe (visually weak; kept for symmetry)
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
    # v0.3.2 (Round 13 PR 13.2 — closes FN-023): package-name
    # official-claim shapes. Distinct from the vendor-brand
    # patterns above — these draw from _HIGH_TRUST_PACKAGES which
    # holds the specific published-artifact names attackers
    # impersonate (ua-parser-js, eslint, lodash, etc.).
    (
        rf"\b(?:the\s+)?official\s+(?:{_HIGH_TRUST_PACKAGE_ALT})\s+(?:primitive|skill|tool|prompt|agent|integration|sdk|helper|package)",
        "package-official-claim",
    ),
    (
        rf"\bfrom\s+the\s+(?:{_HIGH_TRUST_PACKAGE_ALT})\s+(?:maintainer|maintainers|team|engineering)\b",
        "package-official-claim",
    ),
    (
        rf"\bendorsed\s+by\s+(?:the\s+)?(?:{_HIGH_TRUST_PACKAGE_ALT})\s+(?:maintainer|maintainers|team|engineering)\b",
        "package-official-claim",
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

# v0.3.0 (Round 7 PR 7.2 — generic Unicode confusables, replaces
# the v0.2.4 hardcoded Anthropic/OpenAI patterns). Implements UTS
# #39's "skeleton" identifier-comparison method scoped to the
# project's vendor list. Each canonical single-word vendor has a
# precomputed skeleton (lowercase Latin form); each input "word"
# containing any non-ASCII codepoint is mapped through
# CONFUSABLES_MAP and compared to the vendor-skeleton set. A match
# means an attacker rendered a vendor name with one or more
# Cyrillic / Greek confusable substitutions — the classic visual-
# impersonation supply-chain shape.
#
# Lockstep with packages/phub/src/scanners/t7-poisoned-naming.ts § v0.3.0.
_CONFUSABLES_MAP: dict[str, str] = {
    # Cyrillic uppercase
    "А": "A",
    "В": "B",
    "С": "C",
    "Е": "E",
    "Н": "H",
    "І": "I",
    "К": "K",
    "М": "M",
    "О": "O",
    "Р": "P",
    "Ѕ": "S",
    "Т": "T",
    "Х": "X",
    # Cyrillic lowercase
    "а": "a",
    "с": "c",
    "е": "e",
    "о": "o",
    "р": "p",
    "ѕ": "s",
    # Greek uppercase
    "Α": "A",
    "Β": "B",
    "Ε": "E",
    "Η": "H",
    "Ι": "I",
    "Κ": "K",
    "Μ": "M",
    "Ν": "N",
    "Ο": "O",
    "Ρ": "P",
    "Τ": "T",
    "Υ": "Y",
    "Χ": "X",
    "Ϲ": "C",
    # Greek lowercase
    "α": "a",
    "ο": "o",
    "ρ": "p",
}


def _skeleton(s: str) -> str:
    return "".join(_CONFUSABLES_MAP.get(ch, ch) for ch in s)


def _has_non_ascii(s: str) -> bool:
    return any(ord(ch) > 127 for ch in s)


# Single-word vendors only. Multi-word forms ("Hugging Face") have
# single-word siblings in the list ("HuggingFace") so the homoglyph
# check still catches their attack shape.
_SINGLE_WORD_VENDOR_SKELETONS: dict[str, str] = {
    _skeleton(v).lower(): v for v in _VENDORS if " " not in v
}

# Word tokenizer: contiguous run of letters / digits / "._-" with a
# letter-class anchor. Latin + Cyrillic + Greek blocks (the ranges
# the confusables map handles).
_HOMOGLYPH_WORD_RE = re.compile(
    r"[A-Za-zͰ-ϿЀ-ӿ]"
    r"[A-Za-z0-9._Ͱ-ϿЀ-ӿ\-]*"
)

_ALL_PATTERNS = _OFFICIAL_CLAIM_PATTERNS + _FALSE_AFFILIATION_PATTERNS + _TYPOSQUAT_TUPLES

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
            "If this is a foreign-language reference, use the language's native "
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
    detector_version = "0.3.2"

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
                if is_in_frontmatter(match.start(), md_ctx) or is_in_inline_code(
                    match.start(), md_ctx
                ):
                    continue
                if tag == "vendor-typosquat" and is_in_mention_context(
                    ctx.content, match.start(), match.end()
                ):
                    continue
                hints.append(_hint_for_match(ctx.content, match, tag))
                if len(hints) >= _MAX_HINTS_PER_VERDICT:
                    break
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break

        # v0.3.0 (Round 7 PR 7.2): generic homoglyph pass using
        # UTS #39 skeleton comparison. Tokenises the content into
        # words, skips pure-ASCII words, maps non-ASCII codepoints
        # through _CONFUSABLES_MAP, compares the resulting skeleton
        # to _SINGLE_WORD_VENDOR_SKELETONS. Hits fire
        # `vendor-homoglyph`.
        for word_match in _HOMOGLYPH_WORD_RE.finditer(ctx.content):
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
            word = word_match.group(0)
            if not _has_non_ascii(word):
                continue
            skel = _skeleton(word).lower()
            canonical = _SINGLE_WORD_VENDOR_SKELETONS.get(skel)
            if canonical is None:
                continue
            if is_in_frontmatter(word_match.start(), md_ctx) or is_in_inline_code(
                word_match.start(), md_ctx
            ):
                continue
            if is_in_mention_context(ctx.content, word_match.start(), word_match.end()):
                continue
            snippet = f'{word} (renders as "{canonical}" via Cyrillic/Greek confusables)'
            hints.append(
                DiffHint(
                    line=ctx.content.count("\n", 0, word_match.start()) + 1,
                    snippet=snippet[:_SNIPPET_MAX_CHARS]
                    + ("…" if len(snippet) > _SNIPPET_MAX_CHARS else ""),
                    suggestion=(
                        "Vendor name appears with a non-ASCII letter visually identical "
                        "to the canonical Latin spelling (Cyrillic / Greek confusable). "
                        "This is the classic visual-impersonation shape and never benign "
                        "in primitive content. If this is a foreign-language reference, "
                        'use the language\'s native spelling (e.g. "Антропик") rather '
                        "than a mixed-script form."
                    ),
                    detail_tag="vendor-homoglyph",
                )
            )

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

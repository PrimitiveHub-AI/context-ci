"""T9 — Copyright-contaminated primitives.

The threat model: a primitive that embeds verbatim license-marked
text, third-party proprietary boilerplate, or copy-pasted forum
content with attribution requirements. Consuming the primitive
exposes the user to licensing risk (GPL contamination, CC-BY-SA
attribution requirements, "All Rights Reserved" infringement
claims).

What this detector flags (v0.1, mechanical patterns only)
--------------------------------------------------------

  permissive-license-header
    Verbatim MIT / Apache / BSD / MPL license boilerplate phrases.
    Matches LONG canonical phrases, not bare "MIT License" tokens,
    so primitives that legitimately discuss open-source licensing
    don't trigger.

  gpl-header
    Verbatim GNU GPL / LGPL / AGPL boilerplate. Same long-phrase
    discipline.

  proprietary-copyright-notice
    Third-party copyright notices: "© <vendor> <year>",
    "Copyright (c) <year> <vendor>", "All Rights Reserved" after a
    third-party name. Caveat: the primitive's OWN copyright line is
    legitimate and is allowed via the FP-resolution flow per
    ADR-0030.

  cc-attribution-required
    Creative Commons license markers (CC-BY, CC-BY-SA, CC-BY-NC)
    indicating attribution is REQUIRED for consuming the content.

  forum-source-attribution
    "Source: stackoverflow.com" / "From: reddit.com" / "Adapted from
    github.com/<owner>/<repo>" — content from sources with CC-BY-SA
    or other attribution requirements.

What v0.1 does NOT do
---------------------

License-text fingerprinting against a license database (SPDX corpus
similarity). Phase 6+ adds the optional fingerprint step; v0.1's
boilerplate match catches the obvious copy-paste cases.

Known false positives
---------------------

A primitive teaching about software licensing or copyright (e.g. a
secure-licensing primitive) will legitimately quote boilerplate.
v0.1's stance: flag and bounce to manual review. The
FP-resolution methodology (ADR-0030) is the right mechanism — write
a narrow allow + an FP-NNN ledger entry.
"""

from __future__ import annotations

import re

from .markdown_context import (
    analyze_markdown_context,
    is_in_frontmatter,
    is_in_inline_code,
)
from .types import DetectorContext, DiffHint, Severity, Verdict

_PERMISSIVE_LICENSE_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\bPermission\s+is\s+hereby\s+granted,?\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy",
        "permissive-license-header",
    ),
    (
        r"\bRedistribution\s+and\s+use\s+in\s+source\s+and\s+binary\s+forms,?\s+with\s+or\s+without\s+modification",
        "permissive-license-header",
    ),
    (
        r"\bLicensed\s+under\s+the\s+Apache\s+License,?\s+Version\s+2\.0\s+\(the\s+[\"']?License[\"']?\)",
        "permissive-license-header",
    ),
    (
        r"\bThis\s+Source\s+Code\s+Form\s+is\s+subject\s+to\s+the\s+terms\s+of\s+the\s+Mozilla\s+Public\s+License",
        "permissive-license-header",
    ),
    (
        r"\bSPDX-License-Identifier:\s+(?:MIT|Apache-2\.0|BSD-[23]-Clause|MPL-2\.0|ISC)",
        "permissive-license-header",
    ),
)

_GPL_LICENSE_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\bThis\s+program\s+is\s+free\s+software[:;]\s+you\s+can\s+redistribute\s+it\s+and/or\s+modify",
        "gpl-header",
    ),
    (
        r"\bThis\s+library\s+is\s+free\s+software[:;]\s+you\s+can\s+redistribute\s+it\s+and/or\s+modify",
        "gpl-header",
    ),
    (
        r"\bunder\s+the\s+terms\s+of\s+the\s+GNU\s+(?:General|Lesser|Affero|Library)\s+(?:General\s+)?Public\s+License",
        "gpl-header",
    ),
    (
        r"\bSPDX-License-Identifier:\s+(?:GPL-[23]\.0(?:-(?:only|or-later))?|LGPL-[23]\.[01](?:-(?:only|or-later))?|AGPL-3\.0(?:-(?:only|or-later))?)",
        "gpl-header",
    ),
)

# Year regex helper used in proprietary patterns. Allow 19xx-21xx
# to keep year matching robust across decades.
_YEAR = r"(?:19|20|21)\d{2}(?:[-,]\s?(?:19|20|21)\d{2})?"

_PROPRIETARY_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        # "Copyright © 2023 Acme, Inc. All rights reserved."
        rf"©\s*{_YEAR}\s+[A-Z][\w.,&\s-]{{2,60}}?\s+All\s+(?:R|r)ights\s+(?:R|r)eserved",
        "proprietary-copyright-notice",
    ),
    (
        rf"\bCopyright\s+(?:©|\(c\)|\(C\))\s*{_YEAR}\s+[A-Z][\w.,&\s-]{{2,60}}?\s+All\s+(?:R|r)ights\s+(?:R|r)eserved",
        "proprietary-copyright-notice",
    ),
    (
        # Bare "All Rights Reserved" near a year is suspicious enough.
        rf"\bAll\s+Rights\s+Reserved\b.{{0,40}}\b{_YEAR}\b",
        "proprietary-copyright-notice",
    ),
    (
        rf"\b{_YEAR}\s+[A-Z][\w.,&\s-]{{2,60}}?\s+All\s+Rights\s+Reserved",
        "proprietary-copyright-notice",
    ),
)

_CC_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\b(?:CC|Creative\s+Commons)[\s_-]?BY[\s_-]?SA(?:[\s_-]?\d(?:\.\d)?)?",
        "cc-attribution-required",
    ),
    (
        r"\b(?:CC|Creative\s+Commons)[\s_-]?BY[\s_-]?NC(?:[\s_-]?\d(?:\.\d)?)?",
        "cc-attribution-required",
    ),
    (
        r"\b(?:CC|Creative\s+Commons)[\s_-]?BY(?:[\s_-]?\d(?:\.\d)?)?(?!\w)",
        "cc-attribution-required",
    ),
    (
        r"\blicensed\s+under\s+Creative\s+Commons\b",
        "cc-attribution-required",
    ),
)

_FORUM_PATTERNS: tuple[tuple[str, str], ...] = (
    (
        r"\b(?:Source|From|Adapted\s+from|Taken\s+from|Copied\s+from|Borrowed\s+from):\s*(?:https?://)?(?:www\.)?stackoverflow\.com\b",
        "forum-source-attribution",
    ),
    (
        r"\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?://)?(?:www\.)?reddit\.com\b",
        "forum-source-attribution",
    ),
    (
        r"\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?://)?(?:www\.)?(?:medium\.com|dev\.to|substack\.com)/\S+",
        "forum-source-attribution",
    ),
    (
        r"\b(?:Source|From|Adapted\s+from|Taken\s+from):\s*(?:https?://)?github\.com/\S+/\S+",
        "forum-source-attribution",
    ),
)

_ALL_PATTERNS = (
    _PERMISSIVE_LICENSE_PATTERNS
    + _GPL_LICENSE_PATTERNS
    + _PROPRIETARY_PATTERNS
    + _CC_PATTERNS
    + _FORUM_PATTERNS
)

_COMPILED = tuple(
    (re.compile(pattern, re.IGNORECASE | re.MULTILINE | re.DOTALL), tag)
    for pattern, tag in _ALL_PATTERNS
)

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


_SUGGESTION_BY_TAG = {
    "permissive-license-header": (
        "Verbatim MIT / Apache / BSD / MPL license boilerplate embedded in a primitive. "
        "If the primitive is teaching about licensing, allow it via policy + FP ledger "
        "(per ADR-0030). Otherwise remove or attribute the copied text."
    ),
    "gpl-header": (
        "Verbatim GPL / LGPL / AGPL boilerplate embedded in a primitive. Consuming the "
        "primitive imports the GPL family's strong-copyleft obligations onto the "
        "consumer's project. Remove the boilerplate or replace with attribution + a "
        "link to the upstream source."
    ),
    "proprietary-copyright-notice": (
        "Third-party copyright notice ('© <vendor> <year>' / 'All Rights Reserved') "
        "embedded in primitive content. If the notice is the project's own, allow via "
        "policy with an FP-NNN ledger entry. Otherwise the embedded content is "
        "unattributed third-party material."
    ),
    "cc-attribution-required": (
        "Creative Commons license marker indicates attribution is required for "
        "downstream use. Add the canonical attribution + link to the original source, "
        "or remove the content."
    ),
    "forum-source-attribution": (
        "Forum / community source link suggests the primitive copies content from a "
        "site with attribution requirements (Stack Overflow content is CC-BY-SA; "
        "GitHub READMEs carry their own licenses). Verify the upstream license and "
        "either inline the attribution or rephrase in the operator's own words."
    ),
}


def _hint_for_match(content: str, match: re.Match[str], tag: str) -> DiffHint:
    line_no = content.count("\n", 0, match.start()) + 1
    raw = match.group(0)
    snippet = raw[:_SNIPPET_MAX_CHARS] + ("…" if len(raw) > _SNIPPET_MAX_CHARS else "")
    return DiffHint(
        line=line_no,
        snippet=snippet,
        suggestion=_SUGGESTION_BY_TAG.get(tag, "Copyright contamination pattern matched."),
        detail_tag=tag,
    )


class T9CopyrightContaminationDetector:
    """Concrete `Detector` for T9. Stateless; pre-compiled regex pool."""

    name = "t9.copyright_contamination"
    threat_category = "T9"
    cci_id = "CCI-009"
    detector_version = "0.2.1"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        # v0.2.1 (ADR-0035): skip matches inside frontmatter (the
        # primitive's own license declaration) and inline-code spans
        # (license strings inside code references). Body-text license
        # mentions still flag pending v0.2.2 declaration-vs-quotation work.
        md_ctx = analyze_markdown_context(ctx.content)

        for pattern, tag in _COMPILED:
            for match in pattern.finditer(ctx.content):
                if is_in_frontmatter(match.start(), md_ctx) or is_in_inline_code(match.start(), md_ctx):
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
                summary="No copyright-contamination patterns matched.",
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
                f"Matched {len(hints)} copyright-contamination pattern{plural}; "
                "downstream licensing risk."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )

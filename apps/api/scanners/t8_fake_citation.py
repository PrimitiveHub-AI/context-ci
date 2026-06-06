"""T8 — Fake citations / fake expertise claims.

The threat model: references that look authoritative but cite
nonexistent sources — leading the agent to generate
plausible-sounding falsehoods.

v0.1 scope: mechanical pattern checks that don't require network
lookups (Phase 6+ adds the resolve-and-verify step). The mechanical
checks catch the obvious crap:

What this detector flags
------------------------

  invalid-cve
    CVE-YYYY-NNNNN where YYYY is in the future or unreasonably old
    (pre-1999). CVEs allocated in the future are by definition
    fabricated; pre-1999 is before the CVE program existed.

  invalid-rfc
    RFC NNNN where NNNN > 9999 (no such RFC) or NNNN == 0.

  invalid-arxiv
    arXiv:YYMM.NNNNN where YYMM is in the future (impossible) or
    YYMM is structurally invalid (month > 12 or < 1).

  vague-citation
    "according to research", "studies show", "experts agree",
    "industry standard", "as documented in" — without a URL, DOI,
    or other resolvable reference within the next 200 characters.
    The vague-citation rhetoric, ungrounded, is the load-bearing
    trick of hallucinated-source attacks.

  fake-doi-prefix
    DOI: 10.XXXX/anything where 10.XXXX isn't in the registry of
    accepted DOI authorities. v0.1 ships a short authoritative
    prefix list; v0.2 expands.

What v0.1 does NOT do
---------------------

Network resolution. Phase 6+ adds an opt-in "resolve every cited URL"
pipeline; v0.1 catches the mechanical-fake cases that don't need it.

Detector uses the system clock to determine "current year." The
conformance fixtures use a far-future year (2099) so they remain
detectable regardless of when CI runs.
"""

from __future__ import annotations

import re
from datetime import datetime

from .types import DetectorContext, DiffHint, Severity, Verdict


def _current_year() -> int:
    """Wrapper so tests can mock if needed. Detector behavior
    intentionally depends on the system clock — the conformance
    fixtures use 2099 to stay deterministic across years."""
    return datetime.now().year


# CVE-YYYY-NNNN format. Capture YYYY as group 1.
_CVE_RE = re.compile(r"\bCVE-(\d{4})-(\d{4,7})\b")

# "RFC NNNN" or "RFC NNNNN" (allow optional space-vs-dash).
_RFC_RE = re.compile(r"\bRFC[\s-]?(\d{1,7})\b", re.IGNORECASE)

# arXiv IDs (modern format YYMM.NNNNN, optional vN suffix).
_ARXIV_RE = re.compile(r"\barXiv:(\d{2})(\d{2})\.(\d{4,5})(?:v\d+)?\b", re.IGNORECASE)

# v0.2.3 (Round 7 closure 3 — closes holdout FN-012 on S-100
# "US Patent 99,999,999 (issued 2099)"). US Patent numbers are
# monotonic + the year of issuance is bounded. Two implausibility
# signals: year outside [1790, currentYear+1] OR patent number above
# 99,000,000 (current 2026 issuance is ~13M; reserving 99M+ as
# "clearly attacker-fabricated"). Either fires `invalid-patent`.
# Lockstep with packages/phub/src/scanners/t8-fake-citation.ts § v0.2.3.
_PATENT_RE = re.compile(
    r"\bUS\s+Patent\s+([\d,]{4,12})(?:\s*\(?\s*(?:issued|granted|filed)?\s*(\d{4}))?",
    re.IGNORECASE,
)
_PATENT_IMPLAUSIBLE_NUMBER = 99_000_000
_PATENT_PROGRAM_START_YEAR = 1790

# DOI prefixes we treat as accepted authorities. v0.2 (2026-06-04)
# expands the list from 28 to ~80 prefixes after `/check` flagged
# `10.1184` (Carnegie Mellon) as fake on a real cybersecurity-skills
# repo — see FP-009 in docs/false-positive-resolution.md. The new
# list covers major commercial publishers, university presses, US
# federal research orgs (NIST is critical for cybersecurity
# citations), preprint servers, and large open-access publishers.
# (Source: top-200 publishers + university registrants by DOI
# registration volume.)
_ACCEPTED_DOI_PREFIXES: frozenset[str] = frozenset({
    # ─── Major commercial publishers ───
    "10.1006",   # Academic Press (now Elsevier)
    "10.1007",   # Springer
    "10.1016",   # Elsevier (volume leader)
    "10.1017",   # Cambridge University Press
    "10.1038",   # Nature
    "10.1051",   # EDP Sciences
    "10.1057",   # Palgrave Macmillan
    "10.1075",   # John Benjamins
    "10.1080",   # Taylor & Francis
    "10.1093",   # Oxford University Press
    "10.1109",   # IEEE
    "10.1126",   # Science / AAAS
    "10.1145",   # ACM
    "10.1146",   # Annual Reviews
    "10.1162",   # MIT Press
    "10.1177",   # SAGE Publications
    "10.1186",   # BMC / SpringerOpen
    "10.1198",   # American Statistical Association
    "10.1207",   # LEA / Lawrence Erlbaum
    "10.1257",   # American Economic Association
    "10.1287",   # INFORMS (operations research)
    "10.1364",   # Optica (formerly OSA)
    "10.1371",   # PLOS
    "10.1503",   # CMA (Canadian Medical Assoc)
    "10.1525",   # UC Press
    "10.1542",   # AAP (Pediatrics)
    "10.1561",   # NOW Publishers (foundations + trends)
    "10.1613",   # JAIR
    "10.2105",   # APHA (public health)
    "10.2139",   # SSRN
    "10.2200",   # Morgan & Claypool / Synthesis Lectures
    "10.2202",   # De Gruyter
    "10.2307",   # JSTOR
    "10.3322",   # American Cancer Society
    "10.3389",   # Frontiers
    "10.3390",   # MDPI
    "10.4135",   # SAGE Reference
    "10.4314",   # African Journals OnLine
    "10.5210",   # First Monday
    "10.5281",   # Zenodo
    "10.5772",   # IntechOpen
    "10.5061",   # Dryad
    "10.5067",   # NASA (Earth-science data)
    "10.7287",   # PeerJ Preprints
    "10.7551",   # MIT Press (some imprints)
    "10.7717",   # PeerJ
    # ─── Preprint / repository servers ───
    "10.13140",  # ResearchGate
    "10.21437",  # ISCA (Interspeech)
    "10.31219",  # OSF (general)
    "10.31234",  # PsyArXiv
    "10.31235",  # SocArXiv
    "10.31222",  # MarXiv (marine science)
    "10.36227",  # TechRxiv (engineering preprints)
    "10.48550",  # arXiv (DOI form)
    "10.6084",   # Figshare
    # ─── Universities + research institutions ───
    "10.1184",   # Carnegie Mellon University
    "10.7916",   # Columbia University
    "10.7298",   # Cornell University Library
    "10.7910",   # Dataverse (Harvard)
    "10.13016",  # University of Connecticut
    "10.17615",  # UNC Chapel Hill repositories
    "10.18034",  # Linköping University
    "10.22152",  # Penn State
    "10.23943",  # Princeton University Press
    "10.24432",  # UC Irvine ML Repository
    "10.25394",  # UC San Diego
    "10.34740",  # MIT DSpace
    "10.34894",  # ETH Zurich
    # ─── Open-access scholarly orgs ───
    "10.18653",  # ACL Anthology
    "10.21105",  # JOSS
    "10.14778",  # VLDB
    "10.13039",  # Crossref Funding ID
    # ─── US federal research orgs (critical for security/CS citations) ───
    "10.6028",   # NIST (US National Institute of Standards and Technology)
    "10.2172",   # OSTI (US DOE)
    "10.18434",  # NIST (alternate)
    "10.25333",  # USGS
    # ─── International standards bodies ───
    "10.3403",   # BSI (British Standards Institute)
    # ─── Government agencies ───
    "10.21236",  # DTIC (US DoD)
})
_DOI_RE = re.compile(r"\b(?:DOI:?\s*|doi\.org/)(10\.\d{4,9})/([^\s\"',]+)", re.IGNORECASE)

# Vague-citation triggers. The detector flags these IF no URL / DOI /
# arXiv / RFC reference appears within a short window after the match.
_VAGUE_TRIGGERS = (
    r"\baccording\s+to\s+(?:research|the\s+research|studies|the\s+study|recent\s+studies)",
    r"\bstudies\s+(?:show|demonstrate|confirm|prove)",
    r"\bresearch\s+(?:shows|demonstrates|confirms|proves)",
    r"\b(?:experts|researchers|scientists)\s+agree\b",
    r"\bit\s+is\s+(?:well[\s-]?(?:known|established))\b",
    r"\b(?:industry\s+standard|industry\s+consensus|widely\s+accepted)\s+(?:practice|opinion|view)",
    r"\bas\s+(?:documented|stated|outlined)\s+in\s+(?:the\s+)?(?:literature|standard|specification)\b",
)
_VAGUE_TRIGGER_RE = re.compile("|".join(_VAGUE_TRIGGERS), re.IGNORECASE | re.MULTILINE)

# A "reference signal" — its presence within the lookahead window
# makes a vague-trigger non-suspicious.
_REFERENCE_SIGNAL_RE = re.compile(
    r"https?://|DOI:|doi\.org/|arXiv:|\bRFC\b|\bRFC-?\d|\[\d+\]|\(20\d{2}\)\s*[\.,]",
    re.IGNORECASE,
)

_VAGUE_LOOKAHEAD_CHARS = 200

_MAX_HINTS_PER_VERDICT = 10
_SNIPPET_MAX_CHARS = 120


def _line_for(content: str, position: int) -> int:
    return content.count("\n", 0, position) + 1


def _truncate(s: str) -> str:
    return s[:_SNIPPET_MAX_CHARS] + ("…" if len(s) > _SNIPPET_MAX_CHARS else "")


def _scan_invalid_cves(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    current_year = _current_year()
    for match in _CVE_RE.finditer(content):
        year = int(match.group(1))
        if year > current_year + 1 or year < 1999:
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(match.group(0)),
                    suggestion=(
                        f"CVE year {year} is implausible (current year is {current_year}; "
                        f"CVE program began 1999). This is a fake citation."
                    ),
                    detail_tag="invalid-cve",
                )
            )
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
    return hints


def _scan_invalid_rfcs(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    for match in _RFC_RE.finditer(content):
        rfc_num = int(match.group(1))
        if rfc_num == 0 or rfc_num > 9999:
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(match.group(0)),
                    suggestion=(
                        f"RFC {rfc_num} does not exist (RFCs are numbered 1..9999 "
                        "as of 2026). This is a fake citation."
                    ),
                    detail_tag="invalid-rfc",
                )
            )
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
    return hints


def _scan_invalid_arxiv(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    current_year = _current_year() % 100
    for match in _ARXIV_RE.finditer(content):
        yy = int(match.group(1))
        mm = int(match.group(2))
        # Allow current year + 1 for in-flight submissions; reject
        # beyond that or any month outside 1..12.
        if mm < 1 or mm > 12 or yy > current_year + 1:
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(match.group(0)),
                    suggestion=(
                        f"arXiv ID YYMM={match.group(1)}{match.group(2)} is invalid "
                        f"(month {mm} out of range, or year ahead of {current_year + 2000:d})."
                    ),
                    detail_tag="invalid-arxiv",
                )
            )
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
    return hints


def _scan_invalid_patents(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    current_year = _current_year()
    for match in _PATENT_RE.finditer(content):
        raw_num = (match.group(1) or "").replace(",", "")
        try:
            patent_num = int(raw_num)
        except ValueError:
            continue
        year_str = match.group(2)
        year = int(year_str) if year_str else None
        number_implausible = patent_num >= _PATENT_IMPLAUSIBLE_NUMBER
        year_implausible = year is not None and (
            year < _PATENT_PROGRAM_START_YEAR or year > current_year + 1
        )
        if not (number_implausible or year_implausible):
            continue
        if number_implausible:
            reason = (
                f"patent number {patent_num:,} is above the v0.2 implausibility "
                f"ceiling ({_PATENT_IMPLAUSIBLE_NUMBER:,}; current US issuance "
                f"~13M as of {current_year})"
            )
        else:
            reason = (
                f"year {year} is implausible (US patent program began "
                f"{_PATENT_PROGRAM_START_YEAR}; current year is {current_year})"
            )
        hints.append(
            DiffHint(
                line=_line_for(content, match.start()),
                snippet=_truncate(match.group(0)),
                suggestion=(
                    f"Fake US Patent citation — {reason}. Real patents are at "
                    "patents.uspto.gov; verify the number before signing."
                ),
                detail_tag="invalid-patent",
            )
        )
        if len(hints) >= _MAX_HINTS_PER_VERDICT:
            break
    return hints


def _scan_fake_doi_prefixes(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    for match in _DOI_RE.finditer(content):
        prefix = match.group(1)
        if prefix not in _ACCEPTED_DOI_PREFIXES:
            hints.append(
                DiffHint(
                    line=_line_for(content, match.start()),
                    snippet=_truncate(match.group(0)),
                    suggestion=(
                        f"DOI prefix {prefix!r} is not in the v0.1 accepted-authorities "
                        "list. If this is a legitimate DOI from a less-common registrar, "
                        "verify the registrant ID at https://www.doi.org/registrants_overview.html."
                    ),
                    detail_tag="fake-doi-prefix",
                )
            )
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
    return hints


def _is_quoted_trigger_phrase(content: str, start: int, end: int) -> bool:
    """v0.2.2 (Round 2 — closes corpus FP=2 on CCI-008 meta-discussion
    of trigger phrases in quoted form). When a vague-trigger appears
    inside a "..." or '...' quoted phrase, the prose is describing the
    trigger phrase rather than asserting it. Recognise the case by
    checking for a paired quote-character immediately before AND
    after the match.
    """
    if start == 0 or end >= len(content):
        return False
    before = content[start - 1]
    after = content[end]
    if before not in {'"', "'"}:
        return False
    return after == before


def _scan_vague_citations(content: str) -> list[DiffHint]:
    hints: list[DiffHint] = []
    for match in _VAGUE_TRIGGER_RE.finditer(content):
        if _is_quoted_trigger_phrase(content, match.start(), match.end()):
            continue
        window_start = match.end()
        window = content[window_start : window_start + _VAGUE_LOOKAHEAD_CHARS]
        if _REFERENCE_SIGNAL_RE.search(window):
            continue
        hints.append(
            DiffHint(
                line=_line_for(content, match.start()),
                snippet=_truncate(match.group(0)),
                suggestion=(
                    "Vague authority-appeal without a resolvable citation within the "
                    f"next {_VAGUE_LOOKAHEAD_CHARS} characters. Either inline the source "
                    "(URL / DOI / arXiv / RFC) or rephrase to drop the appeal."
                ),
                detail_tag="vague-citation",
            )
        )
        if len(hints) >= _MAX_HINTS_PER_VERDICT:
            break
    return hints


class T8FakeCitationDetector:
    """Concrete `Detector` for T8. v0.1 mechanical checks only."""

    name = "t8.fake_citation"
    threat_category = "T8"
    cci_id = "CCI-008"
    detector_version = "0.2.3"

    def run(self, ctx: DetectorContext) -> Verdict:
        hints: list[DiffHint] = []
        for scanner in (
            _scan_invalid_cves,
            _scan_invalid_rfcs,
            _scan_invalid_arxiv,
            _scan_invalid_patents,
            _scan_fake_doi_prefixes,
            _scan_vague_citations,
        ):
            if len(hints) >= _MAX_HINTS_PER_VERDICT:
                break
            remaining = _MAX_HINTS_PER_VERDICT - len(hints)
            hints.extend(scanner(ctx.content)[:remaining])

        if not hints:
            return Verdict(
                detector_name=self.name,
                threat_category=self.threat_category,
                cci_id=self.cci_id,
                severity=Severity.INFO,
                passed=True,
                summary="No fake-citation patterns matched.",
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
                f"Matched {len(hints)} fake-citation pattern{plural}; "
                "unverifiable or impossible references."
            ),
            diff_hints=tuple(hints),
            detector_version=self.detector_version,
        )

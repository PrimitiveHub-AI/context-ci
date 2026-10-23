"""keyword-grep baseline — the naive-scanner strawman.

What a competent engineer would write in an afternoon if asked to "scan
agent context for the obvious bad stuff": a per-category list of signature
strings / regexes plus two structural checks (unicode control codepoints,
document size). No context model — it does not know the difference between
an attacker's imperative and a defender's quotation of that same imperative.

The rules below are derived from each threat's SEMANTICS (the real attacker
signatures for CCI-001..010), not reverse-engineered from the corpus. They
are deliberately GENEROUS on recall — the point is to give the strawman its
best shot at catching attacks, then report, unmodified, what that costs in
precision on the hard benign / borderline samples (pedagogical docs that
quote attack phrasing, legitimate install instructions, real citations,
real license files, multilingual RTL text, …).

Every number this produces is measured truth: whatever `compare.py` reports
for this column is exactly what these rules scored on the committed corpus.
"""

from __future__ import annotations

import re

from scanners.types import DetectorContext

from ._base import BaselineDetector, build_detectors

# --- per-category signature sets -------------------------------------------
# Case-insensitive substring/regex families. Kept readable on purpose: this
# IS the specification of the baseline, so it must be auditable at a glance.

_CCI001 = re.compile(
    r"ignore (all )?previous instructions|disregard (the )?(system|above)|"
    r"system prompt|\bact as\b|override (your )?(guardrails|instructions)|"
    r"no refusals|\bDAN\b|disclose your|reveal your (system )?prompt",
    re.IGNORECASE,
)
_CCI003 = re.compile(
    r"base64|b64decode|atob\(|\beval\(|exec\(|rot13|hex decode|"
    r"\\x[0-9a-f]{2}|decode.*(run|execute)|fromCharCode",
    re.IGNORECASE,
)
_CCI004 = re.compile(
    r"https?://|file://|ws(s)?://|\bfetch\(|\bcurl\b|\bwget\b|<iframe|"
    r"requests\.get|urllib|websocket",
    re.IGNORECASE,
)
_CCI005 = re.compile(
    r"curl[^\n|]*\|\s*(ba)?sh|wget[^\n|]*\|\s*(ba)?sh|\bnpx\s+\S|"
    r"pip install|pipx|brew install|\bsudo\b|install\.sh|bash -c|"
    r"reverse shell|/dev/tcp/|nc -e",
    re.IGNORECASE,
)
_CCI006 = re.compile(
    r"process\.env|os\.environ|\$\{?[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD)|"
    r"api[_-]?key|\bsecret(s)?\b|\btoken(s)?\b|webhook|"
    r"(send|post|email|exfil).{0,30}(env|secret|token|credential)",
    re.IGNORECASE,
)
_CCI007 = re.compile(
    r"\bofficial\b|\bendorsed by\b|\bverified\b|\banthropic\b|\bopenai\b|"
    r"\bstripe\b|certified|trusted vendor|published by",
    re.IGNORECASE,
)
_CCI008 = re.compile(
    r"CVE-\d{4}-\d+|RFC\s?\d{3,5}|arXiv:\d|doi:\s?10\.|US\d{7,}B|"
    r"experts agree|studies show",
    re.IGNORECASE,
)
_CCI009 = re.compile(
    r"MIT License|GPL|GNU General Public|Apache License|"
    r"Creative Commons|CC[- ]BY|SPDX-License-Identifier|"
    r"All rights reserved|Copyright \(c\)|©",
    re.IGNORECASE,
)

# CCI-002 unicode-steganography: zero-width + bidi-control codepoints a
# byte-level scan would look for. Operates on decoded content.
_STEG_CODEPOINTS = (
    "​", "‌", "‍", "‎", "‏",  # ZWSP/ZWNJ/ZWJ/LRM/RLM
    "‪", "‫", "‬", "‭", "‮",  # LRE/RLE/PDF/LRO/RLO
    "⁦", "⁧", "⁨", "⁩",            # LRI/RLI/FSI/PDI
    "﻿",                                            # BOM / ZWNBSP
)

# CCI-010 context-bloat: a crude size gate, the obvious structural proxy.
_BLOAT_BYTES = 8_000


def _has_steg(ctx: DetectorContext) -> bool:
    return any(cp in ctx.content for cp in _STEG_CODEPOINTS)


def _is_bloat(ctx: DetectorContext) -> bool:
    if len(ctx.raw_bytes) >= _BLOAT_BYTES:
        return True
    # cheap repetition proxy: a single line repeated many times
    lines = [ln for ln in ctx.content.splitlines() if ln.strip()]
    if len(lines) >= 40 and len(set(lines)) <= len(lines) // 3:
        return True
    return False


_REGEX_RULES = {
    "CCI-001": _CCI001,
    "CCI-003": _CCI003,
    "CCI-004": _CCI004,
    "CCI-005": _CCI005,
    "CCI-006": _CCI006,
    "CCI-007": _CCI007,
    "CCI-008": _CCI008,
    "CCI-009": _CCI009,
}


def _predicate_for(cci_id: str):
    if cci_id == "CCI-002":
        return _has_steg
    if cci_id == "CCI-010":
        return _is_bloat
    rule = _REGEX_RULES.get(cci_id)
    if rule is None:
        return lambda _ctx: False
    return lambda ctx, _r=rule: bool(_r.search(ctx.content))


def get_all_detectors() -> list[BaselineDetector]:
    return build_detectors(_predicate_for)

"""Regression tests for the T7 + T9 false-positive bugs surfaced 2026-06-04.

The two bugs:

  T7 vendor-typosquat
    Character classes in the typosquat patterns accidentally included
    the canonical letter (e.g. `[A4O0]nthropic` matched the literal
    "Anthropic"). Every legitimate vendor mention in a real repo
    fired the detector, drowning out true positives. v0.2.3 dropped
    the canonical letter from the classes.

  T9 license-family in canonical positions
    Apache 2.0 / MIT / CC-BY headers at the top of source files (the
    standard place for license headers) and entire `LICENSE` files
    were flagged as "downstream licensing risk." v0.2.3 exempted the
    header region (first 40 lines) and LICENSE-named files for the
    license-family tags.

These tests assert the detectors no longer fire on the FP shapes
while still firing on the actual attack patterns.
"""

from __future__ import annotations

import pytest

from scanners.t7_poisoned_naming import T7PoisonedNamingDetector
from scanners.t9_copyright_contamination import T9CopyrightContaminationDetector
from scanners.types import DetectorContext, Severity


def _ctx(content: str, *, file_path: str = "") -> DetectorContext:
    return DetectorContext(
        primitive_slug="test",
        semver="0.0.0",
        content=content,
        raw_bytes=content.encode("utf-8"),
        file_path=file_path,
    )


# ---------------------------------------------------------------------------
# T7 — canonical vendor names must NOT fire vendor-typosquat
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "content",
    [
        # The actual FP shapes from the user's GitHub repo scan:
        "# Anthropic Cybersecurity Skills\n\nA collection of skills.\n",
        "Built for Anthropic Claude.\n",
        "ANTHROPIC API key handling guide.\n",
        "Microsoft 365 integration.\n",
        "microsoft.com endpoint config.\n",
        "MICROSOFT-AUTH-ENDPOINT environment variable.\n",
        "Use Okta for SSO.\n",
        "OKTA tenant configuration.\n",
        "Stripe webhooks for billing.\n",
        "Run on Google Cloud, deploy via Vercel.\n",
        # Multiple mentions in one document — the volume case.
        "Anthropic, Microsoft, Google, Okta, Stripe — vendor SDK guide.\n",
    ],
)
def test_t7_does_not_fire_on_canonical_vendor_names(content: str) -> None:
    """Canonical spellings of vendor names must produce a clean verdict.

    This is the explicit regression for the `[A4O0]nthropic` /
    `M[i1l]crosoft` / `[O0]kta` / `St[r1]ipe` bug. If any of these
    fire, the detector has regressed to over-broad matching.
    """
    detector = T7PoisonedNamingDetector()
    verdict = detector.run(_ctx(content))
    typosquat_hints = [h for h in verdict.diff_hints if h.detail_tag == "vendor-typosquat"]
    assert typosquat_hints == [], (
        f"vendor-typosquat fired on canonical name in: {content!r}\nhints: {typosquat_hints}"
    )


@pytest.mark.parametrize(
    ("content", "expected_hit"),
    [
        ("Use Anthrop1c for safety reviews.\n", True),  # 1-for-i
        ("Read about 4nthropic claims.\n", True),  # 4-for-A
        ("Try the M1crosoft tool.\n", True),  # 1-for-i
        ("Mlcrosoft store has it.\n", True),  # l-for-i
        ("Sign in with 0kta.\n", True),  # 0-for-O
        ("Pay with St1ipe.\n", True),  # 1-for-r
        ("OpenAI lookup via 0penAI.\n", True),  # 0-for-O
        ("G0ogle Cloud (zero for o).\n", True),  # 0-for-o
    ],
)
def test_t7_still_fires_on_real_typosquats(content: str, expected_hit: bool) -> None:
    """The actual typosquat shapes still get caught — no regression."""
    detector = T7PoisonedNamingDetector()
    verdict = detector.run(_ctx(content))
    typosquat_hints = [h for h in verdict.diff_hints if h.detail_tag == "vendor-typosquat"]
    if expected_hit:
        assert len(typosquat_hints) >= 1, (
            f"Expected vendor-typosquat to fire on {content!r}, but got: {verdict}"
        )


# ---------------------------------------------------------------------------
# T9 — license headers in canonical positions must NOT fire
# ---------------------------------------------------------------------------

_APACHE_HEADER = (
    "/*\n"
    ' * Licensed under the Apache License, Version 2.0 (the "License");\n'
    " * you may not use this file except in compliance with the License.\n"
    " * You may obtain a copy of the License at\n"
    " *     http://www.apache.org/licenses/LICENSE-2.0\n"
    " */\n"
    "\n"
    "package com.example;\n"
)


def test_t9_does_not_fire_on_apache_header_at_top_of_source_file() -> None:
    """Apache 2.0 header at the top of a source file is canonical.

    Every Apache-licensed file in every Apache-licensed repo has this.
    Flagging it produced overwhelming noise on /check's GitHub scans.
    """
    detector = T9CopyrightContaminationDetector()
    verdict = detector.run(_ctx(_APACHE_HEADER, file_path="src/Foo.java"))
    license_hints = [
        h
        for h in verdict.diff_hints
        if h.detail_tag in {"permissive-license-header", "gpl-header", "cc-attribution-required"}
    ]
    assert license_hints == [], f"License-family hit fired in header region: {license_hints}"


def test_t9_does_not_fire_on_license_file() -> None:
    """A `LICENSE` file is exempt anywhere in its content."""
    detector = T9CopyrightContaminationDetector()
    # Apache header appearing far below the header-region threshold.
    long_license = "\n".join(f"// line {i}" for i in range(60)) + "\n" + _APACHE_HEADER
    verdict = detector.run(_ctx(long_license, file_path="LICENSE"))
    license_hints = [h for h in verdict.diff_hints if h.detail_tag in {"permissive-license-header"}]
    assert license_hints == [], f"License-family hit fired in LICENSE file: {license_hints}"


@pytest.mark.parametrize(
    "file_path",
    [
        "LICENSE",
        "LICENSE.md",
        "license.txt",
        "COPYING",
        "NOTICE",
        "licenses/MIT.md",
    ],
)
def test_t9_exempts_license_named_files(file_path: str) -> None:
    detector = T9CopyrightContaminationDetector()
    verdict = detector.run(_ctx(_APACHE_HEADER, file_path=file_path))
    license_hints = [h for h in verdict.diff_hints if h.detail_tag in {"permissive-license-header"}]
    assert license_hints == [], f"License-family hit fired in {file_path}: {license_hints}"


def test_t9_still_fires_on_license_text_buried_deep_in_a_non_license_file() -> None:
    """A buried Apache 2.0 header in a regular file IS still flagged.

    The exemption is for the canonical header position (first 40 lines)
    OR a license-named file. A skill .md file that pastes a license
    header on line 200 doesn't get a free pass.
    """
    detector = T9CopyrightContaminationDetector()
    deep_content = "\n".join(f"# Section {i}" for i in range(60)) + "\n" + _APACHE_HEADER
    verdict = detector.run(_ctx(deep_content, file_path="SKILL.md"))
    license_hints = [h for h in verdict.diff_hints if h.detail_tag == "permissive-license-header"]
    assert len(license_hints) >= 1, (
        f"Expected T9 to still flag deep license boilerplate; got: {verdict}"
    )


def test_t9_proprietary_copyright_not_exempt_in_header() -> None:
    """The header-region exemption applies ONLY to the open-source-license
    family; proprietary `© ACME 2023 All Rights Reserved` still fires
    even at the top of a file because it's a legitimate signal of
    third-party content being copied in.
    """
    detector = T9CopyrightContaminationDetector()
    content = "Copyright © 2023 Acme, Inc. All Rights Reserved.\n\nbody\n"
    verdict = detector.run(_ctx(content, file_path="src/foo.py"))
    proprietary_hints = [
        h for h in verdict.diff_hints if h.detail_tag == "proprietary-copyright-notice"
    ]
    assert len(proprietary_hints) >= 1, (
        f"Expected proprietary-copyright-notice to fire even in header region: {verdict}"
    )


def test_t9_overall_verdict_clean_for_apache_header_only() -> None:
    """Top-level: an Apache-2.0-headered source file should be CLEAN
    (Severity.INFO), not FAIL."""
    detector = T9CopyrightContaminationDetector()
    verdict = detector.run(_ctx(_APACHE_HEADER, file_path="src/Foo.java"))
    assert verdict.severity == Severity.INFO, f"Expected INFO, got {verdict}"
    assert verdict.passed is True

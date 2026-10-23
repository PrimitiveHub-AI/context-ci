"""Copy-contract tests for the T8 fake-citation detector (RC1 truth fix).

A mechanical implausibility — an out-of-range CVE year, RFC number, or
patent number — proves the identifier is unresolvable as written, NOT that
it was deliberately fabricated (that implies intent, and a transposed year
is equally consistent with a typo). The detector copy must state the
observable, not assert the inference. See phub-detection-quality-audit RC1.
"""

from __future__ import annotations

from scanners.t8_fake_citation import T8FakeCitationDetector
from scanners.types import DetectorContext, Severity


def _ctx(content: str) -> DetectorContext:
    return DetectorContext(
        primitive_slug="test-primitive",
        semver="1.0.0",
        content=content,
        raw_bytes=content.encode("utf-8"),
    )


class TestT8CopyContract:
    def test_future_cve_states_observable_not_fabrication(self) -> None:
        result = T8FakeCitationDetector().run(_ctx("See CVE-2099-99999 for the exploit."))
        assert not result.passed  # detection unchanged
        assert result.severity is Severity.FAIL
        hint = next(h for h in result.diff_hints if h.detail_tag == "invalid-cve")
        assert "This is a fake citation" not in hint.suggestion
        assert "cannot resolve" in hint.suggestion

    def test_out_of_range_rfc_states_observable(self) -> None:
        result = T8FakeCitationDetector().run(_ctx("As specified in RFC 99999."))
        assert not result.passed
        hint = next(h for h in result.diff_hints if h.detail_tag == "invalid-rfc")
        assert "This is a fake citation" not in hint.suggestion
        assert "cannot resolve" in hint.suggestion

    def test_implausible_patent_is_not_asserted_fake(self) -> None:
        result = T8FakeCitationDetector().run(_ctx("US Patent 99,999,999 (issued 2099)"))
        assert not result.passed
        hint = next(h for h in result.diff_hints if h.detail_tag == "invalid-patent")
        assert not hint.suggestion.startswith("Fake US Patent")
        assert hint.suggestion.startswith("Implausible US Patent")

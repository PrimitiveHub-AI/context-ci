"""Parity tests: API ↔ web `lib/types.ts` enum coverage.

These tests prevent silent drift between the frontend's hard-coded literal
unions (`TrustStatus`, `Category`, `CompatibleAgent`, `RiskLevel`) and the
backend's enum / mapping vocabulary.

We don't parse TypeScript here — we encode the expected literal sets as
constants and assert the API's mapping tables cover them. When the frontend
literals change, the constants below must be updated in lockstep.
"""

from __future__ import annotations

from apps.registry.api import (
    _CATEGORY_LABEL_BY_VALUE,
    _TRUST_STATUS_BY_VERDICT,
)
from apps.registry.models import Primitive, PrimitiveVersion


# Mirror of apps/web/lib/types.ts literal unions, as of the parity audit.
WEB_TRUST_STATUSES: set[str] = {"Trusted", "In Review", "Experimental", "Deprecated"}
WEB_CATEGORIES: set[str] = {
    "Software Engineering",
    "Product Design",
    "Cybersecurity",
    "Research & Writing",
    "Architecture",
    "Performance",
    "Agent Behavior",
    "Domain Expertise",
}
WEB_RISK_LEVELS: set[str] = {"low", "medium", "high"}


def test_every_web_category_label_is_mapped() -> None:
    """Every category literal the web ships must be a `Primitive.Category` label."""
    api_labels = set(_CATEGORY_LABEL_BY_VALUE.values())
    missing = WEB_CATEGORIES - api_labels
    assert not missing, f"API category mapping missing labels: {missing}"


def test_every_category_value_is_a_model_choice() -> None:
    """Every `Primitive.Category` value must be one of the model's choices."""
    model_values = {value for value, _label in Primitive.Category.choices}
    for value in _CATEGORY_LABEL_BY_VALUE:
        assert value in model_values, value


def test_every_verdict_maps_to_a_web_trust_status() -> None:
    """Every `PrimitiveVersion.Verdict` value must map to a web TrustStatus."""
    for verdict, _label in PrimitiveVersion.Verdict.choices:
        mapped = _TRUST_STATUS_BY_VERDICT.get(verdict)
        assert mapped is not None, f"verdict {verdict!r} is unmapped"
        assert mapped in WEB_TRUST_STATUSES, (verdict, mapped)


def test_every_web_trust_status_is_reachable() -> None:
    """Every web TrustStatus must be reachable from at least one Verdict."""
    reachable = set(_TRUST_STATUS_BY_VERDICT.values())
    missing = WEB_TRUST_STATUSES - reachable
    assert not missing, f"Web TrustStatuses with no Verdict source: {missing}"


def test_every_web_risk_level_is_a_model_choice() -> None:
    """Web RiskLevel literals must map 1:1 to `Primitive.RiskLevel`."""
    model_values = {value for value, _label in Primitive.RiskLevel.choices}
    assert WEB_RISK_LEVELS == model_values, (WEB_RISK_LEVELS, model_values)

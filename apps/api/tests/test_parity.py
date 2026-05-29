"""Parity tests: API ↔ web `lib/types.ts` enum coverage.

These tests prevent silent drift between the frontend's hard-coded literal
unions (`TrustStatus`, `Category`, `CompatibleAgent`, `RiskLevel`) and the
backend's enum / mapping vocabulary.

We don't parse TypeScript here — we encode the expected literal sets as
constants and assert the API's mapping tables cover them. When the frontend
literals change, the constants below must be updated in lockstep.
"""

from __future__ import annotations

from accounts.schemas import _WEB_ROLE_BY_DB
from registry.api import (
    _CATEGORY_LABEL_BY_VALUE,
    _TRUST_STATUS_BY_VERDICT,
)
from registry.models import Primitive, PrimitiveVersion
from validation.models import PipelineStage, ReviewItem
from validation.schemas import _WEB_STATUS_BY_DB

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
WEB_REVIEW_STATUSES: set[str] = {
    "Needs Security Review",
    "Benchmark Failed",
    "Human Review Pending",
    "Approved",
    "Rejected",
}
WEB_CONTRIBUTOR_ROLES: set[str] = {
    "Maintainer",
    "Verified Expert",
    "Author",
    "Reviewer",
    "Security Reviewer",
}
WEB_PIPELINE_STAGE_STATUSES: set[str] = {"passed", "warning", "failed"}


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
    assert model_values == WEB_RISK_LEVELS, (WEB_RISK_LEVELS, model_values)


def test_every_review_status_maps_to_web_literal() -> None:
    """Every ReviewItem.Status DB value maps to a web ReviewStatus literal."""
    for db_value, _label in ReviewItem.Status.choices:
        mapped = _WEB_STATUS_BY_DB.get(db_value)
        assert mapped is not None, db_value
        assert mapped in WEB_REVIEW_STATUSES, (db_value, mapped)


def test_every_web_review_status_is_reachable() -> None:
    """Every web ReviewStatus must be reachable from one DB status."""
    assert set(_WEB_STATUS_BY_DB.values()) == WEB_REVIEW_STATUSES


def test_every_web_contributor_role_is_reachable() -> None:
    """Every web ContributorRole must be in the role mapping table."""
    assert set(_WEB_ROLE_BY_DB.values()) == WEB_CONTRIBUTOR_ROLES


def test_every_pipeline_stage_status_maps_to_web_literal() -> None:
    """PipelineStage.StageStatus values must equal the web's PipelineStageStatus set."""
    model_values = {value for value, _label in PipelineStage.StageStatus.choices}
    assert model_values == WEB_PIPELINE_STAGE_STATUSES

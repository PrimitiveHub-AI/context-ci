"""The verdict & scoring engine (ADR-0041).

Replaces the single severity→score collapse from ADR-0034 § 4 with a
class-separated, density-aware engine. The headline number measures
*risk*, not regex-hit-count. Reproducible, deterministic, fully
auditable via the `derivation` block.

Public surface:
- `VerdictClass` enum — MALICIOUS / RISKY / POLICY / CLEAN.
- `VERDICT_RUBRIC` — versioned (`cci_id`, `detail_tag`) → class table.
  Layers 1/2/4 (context_annotation / role_class / registry_hit /
  provenance) are interface inputs the rubric accepts but are absent
  in v0.1 until ADR-0042/0043 land. The rubric **fails safe** for
  unknown inputs: it never assigns a tier *below* the severity-default.
- `classify_finding(...)` — per-hint classification + derivation block.
- `aggregate_findings(...)` — flatten per-detector `Verdict` tuples
  into a list of `ClassifiedFinding`s; the density-damp grouping key
  is `(cci_id, detail_tag, normalize_snippet(snippet))`.
- `score_findings(...)` — the new scoring function. POLICY + CLEAN
  never touch the score; MALICIOUS dominates without damping; RISKY
  is density-damped + bounded by `RISKY_CAP`.
- `compute_verdict_summary(...)` — builds the full `summary` payload
  the wire emits, including backward-compatible keys and the new
  class-breakdown + derivation block.

The rubric is versioned at `VERDICT_RUBRIC_VERSION`. The engine itself
is versioned at `VERDICT_ENGINE_VERSION`. Both appear in every emitted
summary so a consumer can detect engine changes without comparing the
formula by eye.

This module is detector-agnostic — it takes `Verdict` tuples and
produces aggregate numbers. The Python and TS implementations are
kept in sync per ADR-0023.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from scanners.reachability import REACH_WEIGHT, classify_role
from scanners.types import Severity, Verdict

# Versioned governance fields. Stay alongside the rubric in this module
# so a `git blame` on either tells you what changed.
VERDICT_ENGINE_VERSION = "0.2"  # 0.2: severity-weighted RISKY (a FAIL ≠ clean)
VERDICT_RUBRIC_VERSION = "0.1"


class VerdictClass(StrEnum):
    """Four classes replace the single severity ladder.

    Order matters: `MALICIOUS > RISKY > POLICY > CLEAN` is the
    promotion order the rubric's fail-safe rule honors (it never
    demotes below the severity-default's class).
    """

    MALICIOUS = "malicious"
    RISKY = "risky"
    POLICY = "policy"
    CLEAN = "clean"


_CLASS_RANK: dict[VerdictClass, int] = {
    VerdictClass.CLEAN: 0,
    VerdictClass.POLICY: 1,
    VerdictClass.RISKY: 2,
    VerdictClass.MALICIOUS: 3,
}


# ─────────────────────────────────────────────────────────────────────────
# Rubric v0.1
# ─────────────────────────────────────────────────────────────────────────
# Keyed on `(cci_id, detail_tag)`. v0.1 entries demote the CCI-009
# license-marker family to POLICY — they're licensing hygiene, not
# security risk. The rubric interface accepts the future inputs
# (`context_annotation`, `role_class`, `registry_hit`, `provenance`)
# but v0.1 ignores them; they're populated by ADR-0042/0043.
#
# Promotions to MALICIOUS are deliberately empty in v0.1 — they require
# positive provenance / role / registry evidence (ADR-0043), and we
# refuse to ship a MALICIOUS promotion that depends on weaker signals.
#
# Adding entries: same governance shape as the corpus + the Top 10.
# Every new entry needs a justification in this docstring and a
# regression test in test_verdict.py asserting the classification.

VERDICT_RUBRIC: dict[tuple[str, str], VerdictClass] = {
    # CCI-009 license family — licensing markers, not malice.
    # See `docs/cbom-v0.1.md` for the use case (CBOM exporters carry
    # license metadata).
    ("CCI-009", "cc-attribution-required"): VerdictClass.POLICY,
    ("CCI-009", "permissive-license-header"): VerdictClass.POLICY,
    ("CCI-009", "gpl-header"): VerdictClass.POLICY,
}


# ─────────────────────────────────────────────────────────────────────────
# Adjudication guidance — "show your work"
# ─────────────────────────────────────────────────────────────────────────
# A signature match is evidence of a PATTERN, not proof of malice. The
# Context Firewall's job is not to declare guilt — it's to surface the
# evidence and tell the human how to tell a true positive from a false
# positive for the *specific* pattern that fired. This copy is the
# difference between a linter ("flagged, deal with it") and a guardian
# ("here's what we found, here's why, here's how you'd know we're wrong").
#
# Keyed by `detail_tag` with a generic fallback. Several T1 families are
# context-aware (the detector already skips matches inside code fences /
# inline code / frontmatter / quotes), so a SURVIVING finding for those
# tags is, by construction, in plain prose — the guidance says so.

_CONTEXT_AWARE_NOTE = (
    " Documented examples inside a ``` code fence, inline `code`, or quotes "
    "are NOT flagged — this match survived that filter, so it's in plain prose. "
    "If it's a teaching example, fence it to clear the finding; if it's a real "
    "directive, remove it."
)

_FINDING_GUIDANCE: dict[str, str] = {
    "override-system-instructions": (
        "This reads as a live instruction telling the agent to disregard its own "
        "rules — the core move of prompt injection." + _CONTEXT_AWARE_NOTE
    ),
    "credential-exfiltration-hint": (
        "This reads as an instruction to send secrets/credentials somewhere." + _CONTEXT_AWARE_NOTE
    ),
    "role-hijack": (
        "This tries to reassign the agent's persona/role (e.g. 'you are now…'). "
        "A primitive teaches a pattern; it should not redefine who the agent is. "
        "Confirm whether it's establishing a role (true positive) or merely "
        "describing one (possible false positive)."
    ),
    "hidden-instructions": (
        "This is a structural carrier for hidden instructions (a system-labelled "
        "fence, a `[SYSTEM]:` marker, an instruction-bearing HTML comment). These "
        "are flagged even inside fences because the fence itself is the vector. "
        "Confirm whether the block actually issues instructions (true positive) or "
        "is inert formatting (false positive)."
    ),
}

_GENERIC_GUIDANCE = (
    "A known-risky pattern matched by signature. Read the highlighted snippet in "
    "its surrounding context to confirm whether it's a real risk or a documented "
    "example before trusting or rejecting the content."
)

_CLASS_MEANING: dict[VerdictClass, str] = {
    VerdictClass.MALICIOUS: (
        "High-confidence malicious indicator (corroborated beyond a bare signature)."
    ),
    VerdictClass.RISKY: (
        "A known-risky pattern matched by signature. Signatures alone are not proof "
        "of malice — this needs a human to confirm in context."
    ),
    VerdictClass.POLICY: "A licensing/policy marker, not a security risk.",
    VerdictClass.CLEAN: "No risk signal from this detector.",
}


def finding_guidance(cci_id: str, detail_tag: str) -> str:
    """How to tell a true positive from a false positive for this pattern."""
    return _FINDING_GUIDANCE.get(detail_tag, _GENERIC_GUIDANCE)


def class_meaning(cls: VerdictClass) -> str:
    """One-line plain-language meaning of a verdict class."""
    return _CLASS_MEANING.get(cls, "")


# ─────────────────────────────────────────────────────────────────────────
# Scoring constants — v0.1 provisional, calibrated against the
# repo-verdict corpus (ADR-0041 § 5). Marked provisional until that
# corpus has enough samples to fit the parameters; the labeled-as-
# provisional discipline is the no-fake-numbers rule.
# ─────────────────────────────────────────────────────────────────────────

#: Penalty per unique density-damped RISKY group, by the group's worst
#: severity. A FAIL outweighs a WARN because the detectors already strip
#: quoted / code-block matches before emitting FAIL — a surviving FAIL is
#: a higher-confidence "real, in-band" hit, not a teaching mention.
#:
#: Calibration target (v0.2): a single FAIL must never read "clean" — it
#: lands in `caution` (100 - 25 = 75). One WARN stays clean (100 - 8 = 92);
#: two WARN tip to caution. Multiple FAILs escalate but stay bounded by
#: `RISKY_CAP`, so signature matches alone can't manufacture high-risk.
RISKY_FAIL_WEIGHT: float = 25.0
RISKY_WARN_WEIGHT: float = 8.0

#: RC4 — per-family calibration. Dual-use install families (a bare named
#: `npx eslint@latest`, `brew install wget`, a prose "install X" step) are
#: routine developer onboarding. The T5 detector still FAILs them — an
#: adversarial npx is NOT softened; it's flagged and blocks — but a signature
#: match on a dual-use shape is lower-confidence than a pipe-to-shell or a
#: security-control bypass, so a FAIL in one of these families contributes a
#: lighter penalty to the aggregate SCORE (never below WARN weight). Keyed on
#: (cci_id, detail_tag) so only these exact T5 families are affected, and the
#: high-confidence T5 families (shell-pipe / policy-bypass / pip-from-source)
#: keep the full FAIL weight. Provisional until corpus-score calibration.
DUAL_USE_FAIL_WEIGHT: float = 12.0
_DUAL_USE_KEYS: frozenset[tuple[str, str]] = frozenset(
    {
        ("CCI-005", "npx-arbitrary-install"),
        ("CCI-005", "brew-install"),
        ("CCI-005", "install-instruction-to-agent"),
    }
)

#: Maximum total penalty contributed by RISKY findings. Floors the
#: dual-use-heavy repo at `100 - RISKY_CAP` = 40 (suspicious).
#: A repo cannot reach high-risk via RISKY findings alone — that's
#: ADR-0041 § 3 "the haystack cannot manufacture a scream."
RISKY_CAP: float = 60.0


def _risky_weight(severity: Severity, cci_id: str = "", detail_tag: str = "") -> float:
    """Per-group RISKY penalty by severity. FAIL > WARN; INFO is never RISKY.

    RC4: a FAIL on a dual-use install family (npx / brew / install-instruction)
    gets a lighter weight than a high-confidence RCE shape — it still FAILs
    (blocks), it just contributes less to the score.
    """
    if severity is not Severity.FAIL:
        return RISKY_WARN_WEIGHT
    if (cci_id, detail_tag) in _DUAL_USE_KEYS:
        return DUAL_USE_FAIL_WEIGHT
    return RISKY_FAIL_WEIGHT


#: Per-MALICIOUS penalty. One MALICIOUS lands the verdict in the
#: high-risk band; subsequent MALICIOUS findings keep cutting.
MALICIOUS_BASE_PENALTY: float = 60.0
MALICIOUS_INCREMENTAL_PENALTY: float = 20.0


# ─────────────────────────────────────────────────────────────────────────
# Verdict bands. Unchanged from ADR-0034 § 4 — the named bands stay,
# only the formula behind them is replaced.
# ─────────────────────────────────────────────────────────────────────────

_BAND_THRESHOLDS: list[tuple[int, str]] = [
    (90, "clean"),
    (70, "caution"),
    (40, "suspicious"),
    (0, "high-risk"),
]


def verdict_band(score: int) -> str:
    """Map a numeric score to a named band. >= 90 clean, >= 70 caution,
    >= 40 suspicious, otherwise high-risk."""
    for threshold, name in _BAND_THRESHOLDS:
        if score >= threshold:
            return name
    return "high-risk"


# ─────────────────────────────────────────────────────────────────────────
# Classification
# ─────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class ClassifiedFinding:
    """A single finding (one DiffHint from one detector) + its class.

    The `derivation` block records which inputs moved this finding to
    its class. A reviewer can re-derive the classification by hand
    from `derivation` alone — that's ADR-0041 § 4.
    """

    cci_id: str
    detail_tag: str
    severity: Severity
    cls: VerdictClass
    detector_name: str
    line: int | None
    snippet: str
    suggestion: str
    derivation: dict[str, str]
    # File context (set when aggregating across multiple files; empty
    # string for single-blob `/check` paths).
    file_path: str = ""


def _severity_default(severity: Severity) -> VerdictClass:
    """Default class assignment when the rubric has no entry.

    FAIL and WARN both default to RISKY: detector signature-only
    matches are evidence of *pattern* not of *malice*. MALICIOUS
    requires the rubric to promote — and v0.1 has no MALICIOUS
    promotions because Layers 2/3/4 (role/registry/provenance) are
    not yet wired. ADR-0043 supplies those inputs.
    """
    if severity is Severity.INFO:
        return VerdictClass.CLEAN
    return VerdictClass.RISKY


def classify_finding(
    cci_id: str,
    detail_tag: str,
    severity: Severity,
    *,
    context_annotation: str | None = None,
    role_class: str | None = None,
    registry_hit: str | None = None,
    provenance: str | None = None,
) -> tuple[VerdictClass, dict[str, str]]:
    """Classify one finding into a `VerdictClass` + return the derivation.

    Lookup order:
      1. Rubric hit on `(cci_id, detail_tag)`.
      2. Default by severity (`_severity_default`).

    The rubric **fails safe** when input layers are unknown — a hit
    that depends on Layer-N inputs is not consulted when those inputs
    are missing. v0.1's rubric only uses `cci_id + detail_tag`, so
    every entry is always evaluable.

    Future Layer-N entries (ADR-0042/0043) can demote below the
    severity-default only when their layer inputs are present. The
    v0.1 implementation only supports the simpler key shape; extending
    to multi-input rubric is an ADR-0041 follow-on.
    """
    derivation: dict[str, str] = {
        "engine": VERDICT_ENGINE_VERSION,
        "rubric": VERDICT_RUBRIC_VERSION,
        "severity": severity.value,
    }
    if context_annotation is not None:
        derivation["context_annotation"] = context_annotation
    if role_class is not None:
        derivation["role_class"] = role_class
    if registry_hit is not None:
        derivation["registry_hit"] = registry_hit
    if provenance is not None:
        derivation["provenance"] = provenance

    rubric_hit = VERDICT_RUBRIC.get((cci_id, detail_tag))
    if rubric_hit is not None:
        derivation["rule"] = "rubric"
        derivation["rubric_key"] = f"{cci_id}/{detail_tag}"
        return rubric_hit, derivation

    default = _severity_default(severity)
    derivation["rule"] = "severity-default"
    return default, derivation


# ─────────────────────────────────────────────────────────────────────────
# Density damping + aggregation
# ─────────────────────────────────────────────────────────────────────────


def normalize_snippet(snippet: str) -> str:
    """Canonical form for the density-damp group key.

    Lowercased + whitespace-collapsed. The intent: a snippet that
    appears in 40 READMEs as "Run `curl -fsSL https://example/install.sh
    | sh`" should collapse to one effective hit regardless of
    surrounding markdown formatting variations.
    """
    return " ".join(snippet.lower().split())


def aggregate_findings(
    file_verdicts: list[tuple[str, tuple[Verdict, ...]]],
) -> list[ClassifiedFinding]:
    """Flatten `(file_path, verdicts)` pairs into classified findings.

    One ClassifiedFinding per DiffHint per Verdict per file. INFO-only
    verdicts (no hints) collapse to a single CLEAN finding so the
    detector run still appears in the summary's class breakdown.
    """
    out: list[ClassifiedFinding] = []
    for file_path, verdicts in file_verdicts:
        # RC2 Pass B: record the reachability role on every finding's
        # derivation (auditable). This feeds the rubric's `role_class`
        # input — v0.1 only annotates with it (no classification branch),
        # so it changes no class. The score-level reach de-weighting lives
        # in _density_groups / score_findings.
        role = classify_role(file_path).value
        for v in verdicts:
            if not v.diff_hints:
                cls, derivation = classify_finding(
                    cci_id=v.cci_id,
                    detail_tag="",
                    severity=v.severity,
                    role_class=role,
                )
                out.append(
                    ClassifiedFinding(
                        cci_id=v.cci_id,
                        detail_tag="",
                        severity=v.severity,
                        cls=cls,
                        detector_name=v.detector_name,
                        line=None,
                        snippet="",
                        suggestion="",
                        derivation=derivation,
                        file_path=file_path,
                    )
                )
                continue
            for h in v.diff_hints:
                cls, derivation = classify_finding(
                    cci_id=v.cci_id,
                    detail_tag=h.detail_tag,
                    severity=v.severity,
                    role_class=role,
                )
                out.append(
                    ClassifiedFinding(
                        cci_id=v.cci_id,
                        detail_tag=h.detail_tag,
                        severity=v.severity,
                        cls=cls,
                        detector_name=v.detector_name,
                        line=h.line,
                        snippet=h.snippet,
                        suggestion=h.suggestion,
                        derivation=derivation,
                        file_path=file_path,
                    )
                )
    return out


def _reach_weight_for_path(file_path: str) -> float:
    """Confidence multiplier for a finding's file by reachability role
    (RC2 Pass B). Empty path (single-blob paste) → UNKNOWN → 1.0, so
    content-mode scores are unchanged. Never 0 — a finding is down-
    weighted, never suppressed."""
    return REACH_WEIGHT[classify_role(file_path)]


@dataclass(frozen=True, slots=True)
class _DensityGroup:
    """One density-damped group of identical RISKY findings."""

    cci_id: str
    detail_tag: str
    snippet_norm: str
    n_occurrences: int
    weight: float
    # RC2 Pass B: max reach-weight across the group's member files. A group
    # whose occurrences ALL live in inert/ambient files (tests/, bench/,
    # docs/) is de-weighted; one occurrence in a loaded/unknown surface
    # keeps it at 1.0 (fail-safe — reachable-anywhere scores full).
    reach_weight: float
    sample_paths: tuple[str, ...]  # up to 5 distinct file paths for audit


def _density_groups(findings: list[ClassifiedFinding]) -> list[_DensityGroup]:
    """Group RISKY findings by (cci_id, detail_tag, normalize_snippet)."""
    grouping: dict[tuple[str, str, str], list[ClassifiedFinding]] = {}
    for f in findings:
        if f.cls is not VerdictClass.RISKY:
            continue
        key = (f.cci_id, f.detail_tag, normalize_snippet(f.snippet))
        grouping.setdefault(key, []).append(f)
    groups: list[_DensityGroup] = []
    for (cci, tag, norm), members in grouping.items():
        # Up to 5 distinct file paths for the audit trail — full lists
        # blow up the response payload on large repos.
        seen_paths: list[str] = []
        for m in members:
            if m.file_path and m.file_path not in seen_paths:
                seen_paths.append(m.file_path)
            if len(seen_paths) >= 5:
                break
        # Weight by the group's worst severity. A group keyed by
        # (cci, tag, snippet) is normally severity-uniform, but check for
        # any FAIL defensively so a FAIL is never discounted to WARN weight.
        worst = (
            Severity.FAIL if any(m.severity is Severity.FAIL for m in members) else Severity.WARN
        )
        # RC2 Pass B: the group's reach-weight is the MAX across its member
        # files — if the same payload appears in even one reachable surface,
        # it is not de-weighted (fail-safe). Only all-inert/ambient groups
        # drop below 1.0.
        reach = max((_reach_weight_for_path(m.file_path) for m in members), default=1.0)
        groups.append(
            _DensityGroup(
                cci_id=cci,
                detail_tag=tag,
                snippet_norm=norm,
                n_occurrences=len(members),
                weight=_risky_weight(worst, cci, tag),
                reach_weight=reach,
                sample_paths=tuple(seen_paths),
            )
        )
    # Deterministic order: highest occurrence first, then by cci/tag.
    groups.sort(key=lambda g: (-g.n_occurrences, g.cci_id, g.detail_tag, g.snippet_norm))
    return groups


# ─────────────────────────────────────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class ScoreResult:
    """Score + derivation for a population of classified findings."""

    score: int
    band: str
    class_counts: dict[VerdictClass, int]
    derivation: dict[str, Any]


def score_findings(findings: list[ClassifiedFinding]) -> ScoreResult:
    """Compute the security score per ADR-0041 § 3.

    Rules:
      - `POLICY` and `CLEAN` never touch the score.
      - Any `MALICIOUS` finding dominates: `max(0, 60 - 20*n)` where
        `n` is the count of MALICIOUS findings (no density damping).
        One MALICIOUS lands at 40 (boundary of suspicious /
        high-risk); two at 20; three+ at 0.
      - Otherwise, RISKY findings are density-damped (one effective
        hit per `(cci_id, detail_tag, normalize_snippet)` group)
        and the sum is capped at `RISKY_CAP`. Score = `100 - capped`.

    The class breakdown is computed across *all* findings — POLICY
    and CLEAN appear in the count even though they don't move the
    score. Reviewers see the full picture.
    """
    counts = Counter(f.cls for f in findings)
    class_counts: dict[VerdictClass, int] = {
        VerdictClass.MALICIOUS: counts.get(VerdictClass.MALICIOUS, 0),
        VerdictClass.RISKY: counts.get(VerdictClass.RISKY, 0),
        VerdictClass.POLICY: counts.get(VerdictClass.POLICY, 0),
        VerdictClass.CLEAN: counts.get(VerdictClass.CLEAN, 0),
    }

    n_malicious = class_counts[VerdictClass.MALICIOUS]
    if n_malicious > 0:
        # MALICIOUS-dominates branch. No density damping. One MALICIOUS
        # = score 40 (top of high-risk); each additional cuts by 20.
        penalty = MALICIOUS_BASE_PENALTY + (n_malicious - 1) * MALICIOUS_INCREMENTAL_PENALTY
        score = max(0, 100 - round(penalty))
        derivation = {
            "rule": "malicious-dominates",
            "engine": VERDICT_ENGINE_VERSION,
            "rubric": VERDICT_RUBRIC_VERSION,
            "n_malicious": n_malicious,
            "base_penalty": MALICIOUS_BASE_PENALTY,
            "incremental_penalty": MALICIOUS_INCREMENTAL_PENALTY,
            "raw_penalty": penalty,
        }
        return ScoreResult(
            score=score, band=verdict_band(score), class_counts=class_counts, derivation=derivation
        )

    # No MALICIOUS findings. Density-damp the RISKY pool, then apply the
    # reachability reach-weight per group (RC2 Pass B): a group whose
    # occurrences all live in inert/ambient files contributes less. This
    # only ever REDUCES a penalty (reach_weight <= 1.0), so a score never
    # rises above its reach-blind baseline.
    groups = _density_groups(findings)
    raw_penalty = sum(g.weight * g.reach_weight for g in groups)
    capped_penalty = min(RISKY_CAP, raw_penalty)
    score = max(0, 100 - round(capped_penalty))
    derivation = {
        "rule": "risky-bounded",
        "engine": VERDICT_ENGINE_VERSION,
        "rubric": VERDICT_RUBRIC_VERSION,
        "n_risky_findings": class_counts[VerdictClass.RISKY],
        "n_risky_groups": len(groups),
        "risky_fail_weight": RISKY_FAIL_WEIGHT,
        "risky_warn_weight": RISKY_WARN_WEIGHT,
        "reach_weighted": True,  # RC2 Pass B: penalties scaled by role reach-weight
        "raw_penalty": raw_penalty,
        "risky_cap": RISKY_CAP,
        "capped_penalty": capped_penalty,
        # Show up to top-10 groups so a reviewer sees what's contributing.
        "top_groups": [
            {
                "cciId": g.cci_id,
                "detailTag": g.detail_tag,
                "occurrences": g.n_occurrences,
                "weight": g.weight,
                "reachWeight": g.reach_weight,
                "effectiveWeight": round(g.weight * g.reach_weight, 2),
                "samplePaths": list(g.sample_paths),
            }
            for g in groups[:10]
        ],
    }
    return ScoreResult(
        score=score, band=verdict_band(score), class_counts=class_counts, derivation=derivation
    )


# ─────────────────────────────────────────────────────────────────────────
# Wire serialization
# ─────────────────────────────────────────────────────────────────────────


def class_counts_to_wire(counts: dict[VerdictClass, int]) -> dict[str, int]:
    """Stable JSON-key shape for the class counts."""
    return {
        "malicious": counts[VerdictClass.MALICIOUS],
        "risky": counts[VerdictClass.RISKY],
        "policy": counts[VerdictClass.POLICY],
        "clean": counts[VerdictClass.CLEAN],
    }


def classified_finding_to_wire(f: ClassifiedFinding) -> dict[str, Any]:
    """Per-finding wire shape including derivation. Used by `/check`."""
    return {
        "cciId": f.cci_id,
        "detailTag": f.detail_tag,
        "severity": f.severity.value,
        "verdictClass": f.cls.value,
        "detectorName": f.detector_name,
        "line": f.line,
        "snippet": f.snippet,
        "suggestion": f.suggestion,
        "filePath": f.file_path,
        "derivation": f.derivation,
        "classMeaning": class_meaning(f.cls),
        "howToJudge": finding_guidance(f.cci_id, f.detail_tag),
    }

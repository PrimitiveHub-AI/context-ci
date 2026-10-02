#!/usr/bin/env python3
"""Ablation + naive-baseline study for the Context CI Python detectors.

Reuses the canonical scoring in measure.py (same score_sample / measure
the regression gate uses), so the ablation deltas are computed exactly
the way the committed baseline is. Each configuration neutralizes one
context-awareness component and re-measures the in-sample slice:

  full       — all guards on (must reproduce the committed baseline)
  -markdown  — analyze_markdown_context returns an empty context, so
               fenced-code / frontmatter / inline-code skipping is off
  -semantic  — negation / mention / declaration / quoted-phrase
               predicates always return False
  naive      — both off; the detectors' raw pattern pools with no
               context awareness (the naive keyword/regex baseline)

Usage (from repo root):
    PYTHONPATH=apps/api python3 bench/scripts/ablation.py
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "apps" / "api"))
sys.path.insert(0, str(REPO / "bench" / "scripts"))

import measure as M  # noqa: E402
from scanners.markdown_context import MarkdownContext  # noqa: E402

SEMANTIC = (
    "is_in_negation_context",
    "is_in_mention_context",
    "is_in_declaration_context",
    "is_in_quoted_phrase",
)
MARKDOWN = ("analyze_markdown_context",)


def _scanner_modules():
    return [m for name, m in sys.modules.items()
            if name.startswith("scanners.") and m is not None]


def _patch(names, replacement):
    """Override `names` to `replacement` everywhere they are bound.
    Returns a restore list of (module, name, original)."""
    saved = []
    for mod in _scanner_modules():
        for n in names:
            if hasattr(mod, n):
                saved.append((mod, n, getattr(mod, n)))
                setattr(mod, n, replacement)
    return saved


def _restore(saved):
    for mod, n, orig in saved:
        setattr(mod, n, orig)


def _empty_md(_content):
    return MarkdownContext()


def _false(*_a, **_k):
    return False


def run(config: str):
    saved = []
    if config in ("-markdown", "naive"):
        saved += _patch(MARKDOWN, _empty_md)
    if config in ("-semantic", "naive"):
        saved += _patch(SEMANTIC, _false)
    try:
        _, _, samples = M.load_manifest()
        in_sample, _ = M.measure(samples, M.select_detectors(None))
    finally:
        _restore(saved)
    macro = M.macro_average(in_sample)
    fp = sum(s.fp for s in in_sample.values())
    tp = sum(s.tp for s in in_sample.values())
    fn = sum(s.fn for s in in_sample.values())
    return macro, fp, tp, fn


def main() -> None:
    print("config      precision  recall   F1      FP  (TP/FN)")
    for cfg in ("full", "-markdown", "-semantic", "naive"):
        macro, fp, tp, fn = run(cfg)
        p = macro["precision_macro"] or 0.0
        r = macro["recall_macro"] or 0.0
        f = macro["f1_macro"] or 0.0
        print(f"{cfg:10s}  {p:7.3f}   {r:6.3f}  {f:6.3f}  {fp:3d}  ({tp}/{fn})")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""compare.py — "what we catch vs alternatives" matrix.

Runs the PrimitiveHub engine AND each transparent baseline in
`bench/alternatives/` against the SAME corpus and emits a comparison matrix.
Only the scanner varies between columns.

Two views, on purpose:

  1. ATTACK-DETECTION view (the headline). Direct, borderline-free counts:
       * adversarial recall = adversarial samples whose primary detector
         fired (severity ≥ the sample's expected severity) / adversarial total
       * benign false-positives = benign samples ANY detector flagged
     This is the intuitive "did it catch attacks without crying wolf" metric.

  2. REGRESSION-METHODOLOGY view (the reproducibility tie-in). The exact
     `measure.measure` → `score_sample` macro P/R/F1 the regression gate
     publishes. The PrimitiveHub column here is asserted equal to the latest
     committed `bench/baseline/*-py.json` — if it ever diverges, this script
     fails loudly rather than quietly shipping a different number than the
     gate. (This macro folds borderline samples in as expected-pass, so a
     do-nothing scanner scores non-zero on it — which is exactly why the
     headline uses view #1, not this.)

NEVER writes under `bench/baseline/` — it cannot move the regression floor.
Writes `bench/comparison/<date>-comparison.json` (source of record) and
`docs/comparison.md` (rendered scoreboard).

    uv run --project apps/api python bench/scripts/compare.py
    uv run --project apps/api python bench/scripts/compare.py --no-write

Spec: ADR-0032 (corpus precision/recall) + ADR-0037 (corpus-as-steering).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
BENCH_ROOT = SCRIPTS_DIR.parent
REPO_ROOT = BENCH_ROOT.parent
for p in (str(SCRIPTS_DIR), str(BENCH_ROOT), str(REPO_ROOT / "apps" / "api")):
    if p not in sys.path:
        sys.path.insert(0, p)

import measure  # noqa: E402  (bench/scripts/measure.py — shared scoring + manifest IO)
from alternatives import BASELINES  # noqa: E402
from scanners.registry import get_all_detectors as phub_detectors  # noqa: E402
from scanners.types import DetectorContext  # noqa: E402

COMPARISON_DIR = BENCH_ROOT / "comparison"
REPORT_PATH = REPO_ROOT / "docs" / "comparison.md"
REPRO_TOLERANCE = 1e-9
CCI_ORDER = [f"CCI-{n:03d}" for n in range(1, 11)]


# ---------------------------------------------------------------------------
# View 1 — attack-detection (clean, borderline-free, computed here)
# ---------------------------------------------------------------------------


def _context(s) -> DetectorContext:
    abs_path = measure.CORPUS_ROOT / s.path
    return DetectorContext(
        primitive_slug=s.id.lower(),
        semver="0.0.0",
        content=abs_path.read_text(encoding="utf-8"),
        raw_bytes=abs_path.read_bytes(),
        file_path=s.path,
    )


def attack_detection(samples, detectors) -> dict[str, Any]:
    """Per-category + overall adversarial recall and benign false-positives.

    A detector 'fires' when its verdict severity ≥ WARN (got ≥ 1), matching
    the harness's benign-FP threshold. An adversarial sample is 'caught' when
    its PRIMARY detector fires at ≥ its expected severity (same TP rule as
    score_sample, restricted to adversarial labels — borderline excluded).
    """
    by_cci = {cci: dict(adv_in=0, caught_in=0, adv_ho=0, caught_ho=0) for cci in CCI_ORDER}
    benign_total = 0
    benign_flagged = 0   # distinct benign samples with ≥1 firing
    fp_firings = 0       # (detector, benign-sample) firings
    for s in samples:
        ctx = _context(s)
        verdicts = {d.cci_id: d.run(ctx) for d in detectors}
        if s.label == "adversarial":
            expected = measure.severity_to_int(s.expected_verdict)
            primary = verdicts.get(s.cci_id)
            got = measure.severity_to_int(measure.detector_verdict_severity(primary)) if primary else 0
            bucket = "ho" if s.holdout else "in"
            by_cci[s.cci_id][f"adv_{bucket}"] += 1
            if got >= expected:
                by_cci[s.cci_id][f"caught_{bucket}"] += 1
        elif s.label == "benign" and not s.holdout:
            benign_total += 1
            fired = [c for c, v in verdicts.items()
                     if measure.severity_to_int(measure.detector_verdict_severity(v)) >= 1]
            if fired:
                benign_flagged += 1
                fp_firings += len(fired)

    adv_in = sum(c["adv_in"] for c in by_cci.values())
    caught_in = sum(c["caught_in"] for c in by_cci.values())
    adv_ho = sum(c["adv_ho"] for c in by_cci.values())
    caught_ho = sum(c["caught_ho"] for c in by_cci.values())
    return {
        "per_cci": by_cci,
        "adv_in_total": adv_in,
        "adv_in_caught": caught_in,
        "adv_in_recall": (caught_in / adv_in) if adv_in else None,
        "adv_ho_total": adv_ho,
        "adv_ho_caught": caught_ho,
        "adv_ho_recall": (caught_ho / adv_ho) if adv_ho else None,
        "benign_total": benign_total,
        "benign_flagged": benign_flagged,
        "benign_fp_firings": fp_firings,
    }


# ---------------------------------------------------------------------------
# View 2 — regression methodology (reuses measure.measure → reproduces gate)
# ---------------------------------------------------------------------------


def _bucket_doc(per, overall, total: int) -> dict[str, Any]:
    return {
        "samples_total": total,
        "per_detector": {cci: asdict(st) for cci, st in sorted(per.items())},
        "overall": overall,
    }


def regression_view(samples, detectors) -> dict[str, Any]:
    in_per, ho_per = measure.measure(samples, detectors)
    return {
        "in_sample": _bucket_doc(in_per, measure.macro_average(in_per),
                                 len([s for s in samples if not s.holdout])),
        "holdout": _bucket_doc(ho_per, measure.macro_average(ho_per),
                               len([s for s in samples if s.holdout])),
    }


def reproducibility_check(phub_reg_in_sample: dict[str, Any]) -> dict[str, Any]:
    latest = measure.latest_baseline("py")
    if latest is None:
        return {"committed_baseline": None, "match": None, "note": "no committed py baseline"}
    committed = json.loads(latest.read_text(encoding="utf-8"))
    max_delta, worst = 0.0, None
    for cci, st in phub_reg_in_sample["per_detector"].items():
        cf1 = committed["per_detector"].get(cci, {}).get("f1")
        mf1 = st.get("f1")
        if cf1 is None or mf1 is None:
            continue
        d = abs(cf1 - mf1)
        if d > max_delta:
            max_delta, worst = d, cci
    return {
        "committed_baseline": latest.name,
        "match": max_delta <= REPRO_TOLERANCE,
        "max_f1_delta": max_delta,
        "worst_detector": worst,
    }


def build_comparison() -> dict[str, Any]:
    corpus_version, top10_version, samples = measure.load_manifest()

    def one(module_detectors):
        return {
            "attack_detection": attack_detection(samples, module_detectors),
            "regression": regression_view(samples, module_detectors),
        }

    scanners: dict[str, Any] = {}
    phub = one(phub_detectors())
    scanners["primitivehub"] = {
        "kind": "engine",
        "description": "PrimitiveHub Context CI Top-10 detectors (the firewall).",
        **phub,
    }
    for label, (module, desc) in BASELINES.items():
        scanners[label] = {"kind": "baseline", "description": desc, **one(module.get_all_detectors())}

    return {
        "version": "0.1",
        "generated_at": datetime.now(timezone.utc).date().isoformat(),
        "corpus_version": corpus_version,
        "top10_version": top10_version,
        "samples": {
            "in_sample": len([s for s in samples if not s.holdout]),
            "holdout": len([s for s in samples if s.holdout]),
            "adversarial_in_sample": len([s for s in samples if s.label == "adversarial" and not s.holdout]),
            "adversarial_holdout": len([s for s in samples if s.label == "adversarial" and s.holdout]),
            "benign_in_sample": len([s for s in samples if s.label == "benign" and not s.holdout]),
        },
        "reproducibility": reproducibility_check(phub["regression"]["in_sample"]),
        "scanners": scanners,
    }


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def _pct(n: float | None) -> str:
    return f"{n*100:.0f}%" if n is not None else "n/a"


def render_markdown(doc: dict[str, Any]) -> str:
    sc = doc["scanners"]
    order = ["primitivehub"] + [k for k in sc if k != "primitivehub"]
    smp = doc["samples"]
    L: list[str] = []
    a = L.append

    a("# What we catch vs alternatives")
    a("")
    a("> **AUTO-GENERATED** by `bench/scripts/compare.py`. Source of record: the latest")
    a("> `bench/comparison/*-comparison.json`. Every column is scored over the *same* corpus")
    a("> and split — only the scanner varies. Re-run:")
    a("> `uv run --project apps/api python bench/scripts/compare.py`.")
    a("")
    a(f"- **Corpus:** v{doc['corpus_version']} (Top 10 v{doc['top10_version']}) — "
      f"{smp['in_sample']} in-sample + {smp['holdout']} holdout "
      f"({smp['adversarial_in_sample']} adversarial attacks + {smp['benign_in_sample']} benign in-sample)")
    a(f"- **Generated:** {doc['generated_at']}")
    repro = doc["reproducibility"]
    if repro.get("match"):
        a(f"- **Reproducibility:** ✓ the PrimitiveHub column re-measured here reproduces the committed "
          f"regression baseline `{repro['committed_baseline']}` exactly (max F1 Δ {repro['max_f1_delta']:.1e}) — "
          f"same numbers the CI gate publishes.")
    else:
        a(f"- **Reproducibility:** ⚠️ PrimitiveHub column diverges from committed baseline "
          f"`{repro.get('committed_baseline')}` (max F1 Δ {repro.get('max_f1_delta')}). Investigate first.")
    a("")

    a("## What the baselines are")
    a("")
    a("Transparent, **in-repo** algorithms (`bench/alternatives/`), not named third-party products.")
    a("A row means exactly its ruleset — nothing is attributed to a tool we did not run. Running")
    a("actual OSS/commercial scanners in pinned containers is the next deliverable (see Roadmap).")
    a("")
    for label in order:
        a(f"- **{label}** ({sc[label]['kind']}): {sc[label]['description']}")
    a("")

    # Headline — attack-detection view
    a("## Headline — attack detection")
    a("")
    a(f"Of the **{smp['adversarial_in_sample']} in-sample adversarial attacks**: how many each scanner")
    a(f"caught, and how many of the **{smp['benign_in_sample']} benign** samples it falsely flagged.")
    a("")
    a("| Scanner | Attacks caught (in-sample) | Attacks caught (holdout) | Benign false-positives | FP firings |")
    a("|---|---:|---:|---:|---:|")
    for label in order:
        ad = sc[label]["attack_detection"]
        bold = "**" if label == "primitivehub" else ""
        caught_in = f"{ad['adv_in_caught']}/{ad['adv_in_total']} ({_pct(ad['adv_in_recall'])})"
        caught_ho = f"{ad['adv_ho_caught']}/{ad['adv_ho_total']} ({_pct(ad['adv_ho_recall'])})"
        benign = f"{ad['benign_flagged']}/{ad['benign_total']}"
        a(f"| {bold}{label}{bold} | {caught_in} | {caught_ho} | {benign} | {ad['benign_fp_firings']} |")
    a("")
    a("*Attacks caught = adversarial samples whose detector fired at the expected severity. "
      "Benign false-positives = distinct benign samples wrongly flagged. FP firings = total "
      "detector firings on benign samples (one benign sample can trip several detectors).*")
    a("")

    # Per-category adversarial recall (in-sample)
    a("## Per-category attacks caught — in-sample")
    a("")
    a("| Scanner | " + " | ".join(CCI_ORDER) + " |")
    a("|---|" + "|".join(["---:"] * len(CCI_ORDER)) + "|")
    for label in order:
        per = sc[label]["attack_detection"]["per_cci"]
        cells = []
        for cci in CCI_ORDER:
            c = per[cci]
            cells.append(f"{c['caught_in']}/{c['adv_in']}" if c["adv_in"] else "—")
        bold = "**" if label == "primitivehub" else ""
        a(f"| {bold}{label}{bold} | " + " | ".join(cells) + " |")
    a("")

    a("## How to read this")
    a("")
    a(f"- **no-scanner** is the floor: nothing inspects the primitive, so it catches **0 of "
      f"{smp['adversarial_in_sample']}** attacks. The status quo for most agent pipelines today.")
    a("- **keyword-grep** is the naive-scanner trap: signature matching catches many obvious attacks")
    a("  but has no context model, so it false-positives on the corpus's deliberately hard benign")
    a("  samples — pedagogical docs that *quote* attack phrasing, legitimate install commands, real")
    a("  citations, real license files. Recall at the cost of precision.")
    a("- **primitivehub** is context-aware (negation, meta-discussion framing, code-fence, byte-level")
    a("  analysis), holding precision on exactly those hard benigns while keeping recall — including")
    a("  on the held-out slice it was never tuned against.")
    a("")

    # Regression-methodology view (reproducibility tie-in)
    a("## Appendix — regression-methodology macro (reproduces the CI gate)")
    a("")
    a("The macro precision/recall/F1 computed by `bench/scripts/measure.py` — the exact number the")
    a("regression gate publishes in [`docs/evaluation.md`](./evaluation.md). This methodology folds")
    a("borderline samples in as expected-pass, so a do-nothing scanner scores non-zero here; that is")
    a("why the headline above uses the direct attack-detection counts instead.")
    a("")
    a("| Scanner | Precision | Recall | F1 | Holdout F1 |")
    a("|---|---:|---:|---:|---:|")
    for label in order:
        reg = sc[label]["regression"]
        ins, ho = reg["in_sample"]["overall"], reg["holdout"]["overall"]
        bold = "**" if label == "primitivehub" else ""
        a(f"| {bold}{label}{bold} | {measure.fmt_num(ins['precision_macro'])} | "
          f"{measure.fmt_num(ins['recall_macro'])} | {measure.fmt_num(ins['f1_macro'])} | "
          f"{measure.fmt_num(ho['f1_macro'])} |")
    a("")

    a("## Roadmap — named third-party columns")
    a("")
    a("Next iteration adds columns for real OSS tools run in pinned containers against this same")
    a("corpus (candidates: trufflehog / gitleaks → CCI-006; promptmap / rebuff / llm-guard → CCI-001;")
    a("unicode linters → CCI-002). That is a heavier deliverable (container pinning + per-tool category")
    a("mapping) tracked in the phub-corpus-eval ledger. Until a tool is actually executed here, it gets")
    a("no row — measured truth only.")
    a("")
    return "\n".join(L) + "\n"


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def print_summary(doc: dict[str, Any]) -> None:
    smp = doc["samples"]
    print(f"Comparison — corpus v{doc['corpus_version']} "
          f"({smp['in_sample']} in-sample + {smp['holdout']} holdout; "
          f"{smp['adversarial_in_sample']} adversarial attacks)")
    repro = doc["reproducibility"]
    tick = "✓" if repro.get("match") else "⚠️"
    print(f"Reproducibility {tick}: PrimitiveHub vs {repro.get('committed_baseline')} "
          f"(max F1 Δ {repro.get('max_f1_delta')})\n")
    print(f"{'scanner':<16}{'caught-in':>12}{'caught-ho':>12}{'benign-FP':>11}{'FP-fire':>9}")
    order = ["primitivehub"] + [k for k in doc["scanners"] if k != "primitivehub"]
    for label in order:
        ad = doc["scanners"][label]["attack_detection"]
        print(f"{label:<16}"
              f"{ad['adv_in_caught']}/{ad['adv_in_total']:<10}"
              f"{ad['adv_ho_caught']}/{ad['adv_ho_total']:<10}"
              f"{ad['benign_flagged']}/{ad['benign_total']:<9}"
              f"{ad['benign_fp_firings']:>9}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="PrimitiveHub vs alternatives comparison matrix.")
    parser.add_argument("--no-write", dest="write", action="store_false",
                        help="print the summary only; do not write JSON or markdown")
    args = parser.parse_args(argv)

    doc = build_comparison()
    print_summary(doc)

    if doc["reproducibility"].get("match") is False:
        print("\ncompare: reproducibility check FAILED — PrimitiveHub column does not match the "
              "committed baseline. Refusing to write the report.", file=sys.stderr)
        return 1

    if args.write:
        COMPARISON_DIR.mkdir(parents=True, exist_ok=True)
        out = COMPARISON_DIR / f"{doc['generated_at']}-comparison.json"
        out.write_text(json.dumps(doc, indent=2) + "\n", encoding="utf-8")
        REPORT_PATH.write_text(render_markdown(doc), encoding="utf-8")
        print(f"\nWrote {out}")
        print(f"Wrote {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

"""Comparison baselines — stand-ins scored against the same corpus as the
PrimitiveHub engine so `compare.py` can build an apples-to-apples matrix.

`BASELINES` is the ordered registry the harness iterates. Add a new
transparent baseline = one module here + one row below. Named third-party
tools (run in pinned containers) land as additional columns later; see
docs/comparison.md § Roadmap and the HONESTY CONTRACT in `_base.py`.
"""

from __future__ import annotations

from . import keyword_baseline, no_scanner

# label → (module, one-line description for the rendered report)
BASELINES: dict[str, tuple[object, str]] = {
    "no-scanner": (
        no_scanner,
        "Status quo: nothing inspects the primitive before load. The floor.",
    ),
    "keyword-grep": (
        keyword_baseline,
        "Naive per-category signature grep + unicode/size checks. No context model.",
    ),
}

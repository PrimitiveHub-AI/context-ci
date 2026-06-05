# Near-threshold primitive

This primitive sits just under the v0.1 CCI-010 thresholds across
all four sub-shapes. It serves as a borderline precision test for
the detector — the structural shape adversarial samples use without
crossing any of the thresholds individually.

The primitive's character count is approximately 1700, well below
the 32000-character oversized threshold but above the 1000-character
floor that activates the heading-proliferation check. Non-trivial
lines in the primitive are intentionally distinct; the duplicate
ratio stays well below the 20% threshold because each substantive
sentence carries different content. Blank-line density is moderate,
sitting under the 40% whitespace-stuffing threshold even though the
file has multiple thematic transitions in its prose.

The single h2 section that follows keeps heading density above the
500-chars-per-h2 floor because the surrounding prose is substantive
enough to justify the structural choice. The detector should report
PASS on this primitive — if any threshold trips, the primitive's
structure should be reviewed against the canonical CCI-010
description in the threat model. The borderline framing means
reasonable people might defend either label, but the v0.2.x default
is to pass primitives whose structural choices are defensible at
density and budget.

## Verdict

The detector reports a clean INFO verdict; no sub-shape threshold
trips on this primitive. The same structural shape adversarial
samples use is present, but each measurable dimension stays under
its respective threshold by a comfortable margin.

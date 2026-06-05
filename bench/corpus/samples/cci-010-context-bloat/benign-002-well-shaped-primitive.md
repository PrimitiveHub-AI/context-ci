# Well-shaped primitive

This primitive is structured to fit within the v0.1 context-bloat
thresholds and serves as a precision anchor for the CCI-010 detector.
The character count stays below the 32k oversized threshold, the
non-trivial lines are largely distinct so the duplicate-ratio check
finds nothing concerning, the blank-line ratio is moderate, and the
heading density sits well above the 500-chars-per-h2 floor.

When the agent loads this primitive, it parses the structural
guidance and applies the documented rules during subsequent turns.
The primitive is small enough to be re-read on each turn without
budget pressure, and the section structure reflects substantive
content rather than visual padding.

## Authoring discipline

Authors of agent-context primitives should treat the context budget
as a scarce resource. Information density matters: each section
should carry enough semantic content to justify its byte cost. A
primitive that contains more headings than substantive sentences is
a smell the operator should refactor; the heading-proliferation
check exists precisely to surface that smell mechanically. Before
publishing, run `phub scan` against the primitive to confirm none
of the CCI-010 thresholds are tripped — the detector emits a
human-readable summary when any one threshold fires and otherwise
returns a clean INFO verdict that the runtime treats as a pass.

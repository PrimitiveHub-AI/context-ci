---
spec_version: "0.1"
name: tufte-data-visualization
version: 0.1.0
type: design
domain: frontend
author: PrimitiveHub Labs (synthesized 2026-05-29 from Edward Tufte's "Visual Display of Quantitative Information")
license: CC-BY-4.0
tokens: 3400
token_budget: 5000
risk_level: low
content_digest: sha256:7f1ec8a1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
  - windsurf
use_when:
  - "Designing any chart, score visualization, or quantitative display in PrimitiveHub"
  - "Building the threat-model panel, attestation chain visualization, or pipeline-stage display"
  - "Implementing the four trust scores (Quality / Safety / Efficiency / Impact) anywhere"
  - "Reviewing benchmark numbers, install counts, percent-deltas before merge"
  - "Generating SVG, canvas, or DOM-based quantitative graphics"
do_not_use_when:
  - "Designing decorative non-data graphics (hero glyphs, brand marks)"
  - "Writing prose without numbers"
attestation: cci-v0.1
description: "Tufte's quantitative-display doctrine, distilled. Data-ink ratio, baseline honesty, lie-factor, chartjunk detection, small multiples, duck detector. Calibrated to PrimitiveHub's trust-visualization needs."
keywords: [data-viz, tufte, dataink, chartjunk, small-multiples, baseline-honesty, lie-factor]
references:
  - "Edward Tufte — The Visual Display of Quantitative Information (2nd Edition)"
---

# Tufte Data Visualization

## Purpose

Teach an AI agent to produce quantitative graphics in PrimitiveHub that
meet Tufte's bar: graphical excellence, integrity, and density. Every
chart, score badge, pipeline timing display, attestation timeline,
threat-model heatmap, or benchmark comparison passes through this
primitive before merge. For a trust-infrastructure product, *visual
deception is a credibility failure*, not a styling preference — the
paper's claims depend on charts that survive scrutiny.

## Core Principles

- **Show the data first.** Visual style, brand color, and decoration
  are secondary to visible evidence. A score badge that doesn't show
  the actual number is broken.

- **Maximize data-ink ratio.** Most pixels should encode data. Erase
  frames, heavy gridlines, redundant labels, decorative shading,
  repeated legends, gradient backgrounds. Erase non-data ink within
  reason; erase redundant data ink; revise and edit.

- **The erase-without-loss test.** If removing a visual element
  doesn't reduce understanding, remove it. Run this pass on every
  chart before shipping.

- **Lie-factor ≈ 1.** Visual change must be proportional to data
  change. A bar twice as tall must represent twice the value. A
  truncated baseline that makes a 2% change look like 30% is a lie.

- **Baseline honesty for bars and areas.** Bars and area encodings
  need meaningful zero baselines. Truncated baselines must be
  explicit, justified, and visually marked.

- **No design variation without data variation.** Visual variation
  should correspond to data variation, never to designer whim. Same
  data → same visual treatment.

- **No chartjunk: vibrations, ducks, grids.** Reject patterns that
  shimmer; reject decorative metaphors that become the message ("the
  duck"); reject heavy gridlines that compete with data. PrimitiveHub's
  cyan accent must never turn a score chart into decorative space art.

- **Per-capita / per-tenant / per-version normalization.** Counts
  must often be normalized (per-org, per-active-user, per-version) to
  avoid false growth stories. Show the denominator.

- **Small multiples for comparison.** When comparing across primitives,
  agents, time windows, or trust statuses, use small multiples with
  identical scales — the reader sees data differences, not design
  differences.

- **Show the question, the timeframe, the comparison, the
  denominator.** Every chart's labels must answer all four. "Quality:
  94" alone is incomplete; "Quality: 94 / 100 (last validation run,
  v1.2.0, vs. prior version 92)" is honest.

## Decision Rules

- **IF a chart uses 3D, perspective, shadows, or volume encoding for
  one-dimensional data THEN** reject. 3D pies, isometric bars, and
  shadow-volume charts distort proportions.

- **IF a bar chart's baseline is non-zero THEN** show the baseline
  break explicitly (zig-zag mark or annotation), and justify in a
  comment. Otherwise the change is exaggerated.

- **IF a chart's data-ink ratio is below ~50% THEN** redesign.
  Likely culprits: heavy gridlines, decorative borders, drop shadows,
  gradient backgrounds, ornamental icons.

- **IF a chart compares N segments and N ≤ 9 THEN** use small
  multiples with shared scale. If N > 9, consider sparkline grid or a
  ranked table.

- **IF a metric is presented THEN** include timeframe AND comparison
  context (target, prior period, peer group) inline. Standalone numbers
  are weak.

- **IF a denominator can change interpretation THEN** show it. "53k
  installs" is meaningless without "of 122k registry visits, 43%
  conversion."

- **IF the visualization uses color encoding THEN** colorblind-safe
  palette, single-hue gradients for ordered data, distinct hues only
  for categorical. PrimitiveHub's success/amber/destructive/violet
  palette is already discrete-categorical-safe — reuse it.

- **IF a label can be placed directly on the data mark THEN** prefer
  direct labels over legends. Legends cost a saccade per lookup.

- **IF a chart uses a logarithmic axis THEN** declare it in the axis
  label and ensure the consumer is sophisticated enough to read it
  (e.g., paper readers yes, /registry visitors no).

- **IF the chart aggregates many observations THEN** show
  distribution (histogram, dot plot) before trusting the aggregate.
  Same summary statistics hide radically different patterns
  (Anscombe's quartet).

- **IF a visual element doesn't show data, explain data, or structure
  data THEN** remove it.

- **IF a percent change is presented THEN** also show the absolute
  numbers and the denominator. "+42%" alone is propaganda.

## Anti-Patterns

- **3D pie charts.** Always wrong. Tilted-perspective slices distort
  proportions visually.
- **Truncated y-axis without baseline break mark.** Manufactures
  drama. If you need to truncate for legibility, mark the break.
- **Decorative gridlines competing with data.** Light gray
  gridlines at 30% opacity are fine; dark gridlines at 80% are not.
- **Brand-color decoration unrelated to data.** Cyan accent on a
  bar chart's frame is decoration; cyan on the data-of-interest bar
  is encoding.
- **Encoding one-dimensional data via two-dimensional area.** A
  circle whose area scales linearly to count is misread.
- **Pictorial scaling.** Stacking little person-icons whose height
  encodes count is chartjunk.
- **Legend dependence when direct labels would work.** Reader
  lookups are expensive cognitively.
- **Highlight-everything coloring.** If every bar is colored
  "important," nothing is important.
- **Aggregating away segments that reverse the trend** (Simpson's
  paradox surface). Show disaggregated views before trusting an
  aggregate.

## Review Checklist

- [ ] Data-ink ratio > 50%; non-data elements (frames, decoration,
      gradients, shadows) erased where possible.
- [ ] Baseline is zero, OR the truncation is explicitly marked and
      justified.
- [ ] No 3D / perspective / volume encoding of 1D quantities.
- [ ] Lie-factor ≈ 1: visual proportion matches data proportion.
- [ ] Timeframe + comparison + denominator visible on every metric.
- [ ] Color palette is the project's existing palette; no new colors
      introduced for chart decoration.
- [ ] Comparisons across segments use small multiples with shared
      scale, OR a ranked table.
- [ ] Direct labels preferred over legends where space permits.
- [ ] No chartjunk: no decorative icons, ducks, vibration patterns,
      heavy gridlines, ornamental borders.
- [ ] Erase-without-loss test passed: every remaining element earns
      its place.
- [ ] If the metric is unverified, `<DemoDataBadge>` accompanies it
      (per `feedback_no_fake_numbers` memory).

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before designing a chart, write the one-sentence purpose: "this
   chart shows X over Y compared to Z." If unclear, the chart is
   premature.
2. Default to bars (rank/magnitude), lines (time-series), dot plots
   (compact comparison), or small multiples (segments). Use pies only
   when there are 2-3 slices and proportion is the point.
3. Compute the data-ink ratio honestly before shipping. If <50%,
   redesign.
4. For PrimitiveHub trust scores (Quality/Safety/Efficiency/Impact),
   always show the four together as a small-multiple group, never
   separately, so the reader compares.
5. For pipeline timing displays, the duration encoding must be linear;
   never log-scale a duration without labeling.
6. For attestation chains and provenance timelines, use dense
   timeline rendering with direct event labels; reject decorative
   spine elements.

## Expected Output Format

When proposing a chart, the agent should produce:

```
WHAT: <one-sentence purpose>
DATA: <what's plotted, with timeframe and denominator>
COMPARISON: <what it's compared against>
ENCODING: <position / length / color — and why this encoding>
SCALE: <linear/log; baseline; range>
LIE-FACTOR CHECK: <data range ÷ visual range, target ≈ 1>
DATA-INK PASS: <what was erased; what survived>
ACCESSIBILITY: <colorblind-safe, contrast, ARIA labels>
```

## Examples

The Workbench score-row composition is a small-multiple group:
four ScoreBadges side-by-side, all on the same 0–100 scale, with
identical visual treatment. Tufte-approved.

The Validation page's pipeline stages display uses direct labels
inline ("Schema Validation passed in 0.3s"), not a separate legend.
Tufte-approved.

The Hero pipeline "06 — Better Agent Output" with `+42% specificity,
+38% originality, +46% compliance` is wrapped with `<DemoDataBadge>`
because those numbers aren't measured yet. Tufte + project policy.

## References

- Edward Tufte — *The Visual Display of Quantitative Information* (2nd Ed.)
- Edward Tufte — *Envisioning Information*
- Companion primitive: [`dashboard-information-design`](./dashboard-information-design.md)
- Demo-data discipline: [feedback_no_fake_numbers memory]

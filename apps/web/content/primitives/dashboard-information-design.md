---
spec_version: "0.1"
name: dashboard-information-design
version: 0.1.0
type: design
domain: frontend
author: PrimitiveHub Labs (synthesized 2026-05-29 from Stephen Few's "Information Dashboard Design")
license: CC-BY-4.0
tokens: 3200
token_budget: 5000
risk_level: low
content_digest: sha256:dac0abc7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a2
compatible_agents:
  - claude-code
  - cursor
  - codex
  - v0
  - windsurf
use_when:
  - "Designing the /registry index page, /validation page, /contributors review queue"
  - "Building any future founder/admin/operational dashboard"
  - "Designing the threat-model panel or attestation analytics surface"
  - "Choosing display media (bullet graph vs gauge, bar vs sparkline, etc.)"
  - "Deciding what belongs on a single screen and what is drilldown"
do_not_use_when:
  - "Designing marketing pages (different rules apply)"
  - "Designing the Workbench (it's an editor, not a dashboard)"
  - "Designing single-purpose forms"
attestation: cci-v0.1
description: "Stephen Few's dashboard doctrine — single-screen control, at-a-glance monitoring, exception highlighting, bullet graphs over gauges, business-function grouping, preattentive encoding."
keywords: [dashboard, stephen-few, single-screen, exception-highlighting, bullet-graph, preattentive]
references:
  - "Stephen Few — Information Dashboard Design (2nd Edition)"
  - "Companion: tufte-data-visualization"
---

# Dashboard Information Design

## Purpose

A dashboard is a *single-screen visual display of the most important
information needed to achieve specific objectives, arranged so it can be
monitored at a glance*. PrimitiveHub's /registry, /validation,
/contributors review queue, and any future founder dashboard or
operational cockpit pass through this primitive's principles before
ship. Dashboard failure is almost always a visual-communication
failure, not a technology failure.

This primitive complements `tufte-data-visualization` (which covers
individual charts). Few covers the *composition* of many charts onto
one decision surface.

## Core Principles

- **Single-screen control surface.** A dashboard fits on one screen
  for its core objective. If it scrolls or fragments, it stops being
  a dashboard and becomes a report.

- **At-a-glance monitoring.** Every widget answers a monitoring
  question in seconds without interpretation gymnastics.

- **Objective-first metric selection.** Metrics are selected by the
  job/objective, not by what's easy to query. Don't display deficient
  proxies because the real measure is hard.

- **Context is mandatory.** A number without comparison is weak. Show
  target, prior period, forecast, norm, peer group, or related
  measure. PrimitiveHub example: "secure-code-review v1.2.0 — Trusted,
  +2 from v1.1.0 quality score" beats "secure-code-review 94."

- **Exception highlighting.** Important deviations must stand out via
  preattentive cues (color, position, motion) WITHOUT overwhelming the
  whole screen. Highlight-everything is highlight-nothing.

- **Display-media fit.** Choose charts by data relationship: time
  series → line; ranking → bar; part-to-whole → stacked bar (rarely
  pie); deviation → centered bar; distribution → histogram/dot plot.
  Don't worship gauges or traffic lights.

- **No-gauge vanity.** Gauges, speedometers, traffic lights consume
  large area for one data point. Replace with a bullet graph
  (compact: actual + target + qualitative ranges in one line).

- **Three dashboard archetypes.** Strategic (high-level + slow
  refresh), analytical (history + drilldown), operational (real-time +
  exceptions). Pick one per surface. Don't mix.

- **Refresh-frequency fit.** Update only as fast as the objective
  requires. Sub-second refresh on a strategic dashboard is noise.

- **Preattentive encoding for emphasis.** Position on a common scale
  is the strongest quantitative encoding. Color, size, motion attract
  attention — reserve for exceptions, not decoration.

- **Gestalt grouping by proximity + similarity + alignment.**
  Spacing > enclosure > color > border. Use the lightest delineation
  that works.

- **Co-locate items that must be compared.** Metrics the reader
  compares must be physically close on the screen.

## Decision Rules

- **IF the proposed display is a gauge or speedometer THEN** replace
  with a bullet graph. Same information, ¼ the space.

- **IF the dashboard requires scrolling for primary monitoring THEN**
  reduce scope. Pick the most important 5-9 widgets; move the rest
  to drilldown pages.

- **IF a metric lacks a comparison (target, prior period, peer)
  THEN** add one or remove the metric. Context-free numbers are
  decoration.

- **IF the surface mixes strategic + operational concerns THEN**
  split into two surfaces. One screen, one objective.

- **IF a precision figure has >2 decimal places for a monitoring
  metric THEN** round. `94` beats `94.13`.

- **IF related metrics aren't co-located THEN** rearrange. The eye
  shouldn't traverse the screen to compare what should compare.

- **IF a gridline or border is heavier than necessary THEN** lighten
  or remove. Whitespace is the primary grouping tool.

- **IF a chart uses color for decoration THEN** strip the color and
  test if comprehension survives. If yes, keep stripped.

- **IF the dashboard's user is operational (security reviewer,
  registry admin) THEN** emphasize exceptions and actionable detail
  (what, where, owner, severity, time).

- **IF the dashboard's user is strategic (executive, investor)
  THEN** emphasize calm, sparse high-level measures with truthful
  context.

- **IF a metric is below a sample-size threshold THEN** suppress or
  annotate with uncertainty. Don't display a 50% conversion rate
  computed from 4 visitors.

## Anti-Patterns

- **Gauges and speedometers everywhere.** Wastes space, encodes
  poorly, looks dated.
- **Traffic lights without a second encoding.** Red/yellow/green
  alone fail colorblind users.
- **Sparkles, gradients, drop shadows on widgets.** Decoration,
  not data.
- **Same chart type for everything.** Bar everything, line
  everything — wastes the display-media-fit opportunity.
- **Brand color as default chart color** instead of meaning-driven.
  Cyan should mean "trust" in our system; if every bar is cyan, the
  meaning evaporates.
- **Pies with >3 slices.** Hard to compare slice angles.
- **Stacked bars when totals don't matter** — use side-by-side
  instead.
- **Dashboards that fragment one decision context across multiple
  screens.** If it's the same objective, it belongs on one screen.
- **Operational dashboards updated daily.** Operations needs
  near-real-time; daily is strategic cadence.
- **Strategic dashboards with WebSocket-pushed updates.** Real-time
  is noise for a slow-moving metric.

## Review Checklist

- [ ] Single-screen for the primary objective.
- [ ] Each metric has timeframe + comparison context inline.
- [ ] No gauges; bullet graphs where ranges + targets are shown.
- [ ] Exception coloring is restrained — only outliers/alerts.
- [ ] Display medium matches data relationship (line/bar/dot/sparkline/
      table chosen deliberately).
- [ ] Refresh frequency matches dashboard archetype
      (strategic/analytical/operational).
- [ ] Related metrics are co-located.
- [ ] Grouping via whitespace + alignment first, borders last.
- [ ] No 3D, no decorative shadow, no gradient background.
- [ ] Color is meaning, not decoration.
- [ ] If categorical color is used, also encode via position/shape so
      colorblind users aren't excluded.
- [ ] Layout supports the natural reading order for the objective.

## Agent Behavior Instructions

When this primitive is loaded, the agent should:

1. Before designing a dashboard surface, identify the *one* objective
   and the *one* user type. Document both at the top of the design.
2. Default to bullet graphs over gauges. Default to line for
   time-series, bar for ranking, dot for compact comparison, table
   for exact-lookup-dominant.
3. Compute "metrics with comparison context" / "metrics total" —
   target 100%. Any metric without context is a future bug.
4. Test each widget by asking "what action does this enable in the
   next 5 seconds?" If the answer is "none," remove or move to
   drilldown.
5. Apply `tufte-data-visualization` rules to each individual chart;
   apply this primitive's rules to the *composition*.
6. For exception highlighting, use the project's existing amber
   (warning) / destructive (error) / success (ok) palette. Never
   introduce a new alert color.
7. For PrimitiveHub specifically, the four trust-score dimensions
   (Quality/Safety/Efficiency/Impact) must always travel as a group.

## Expected Output Format

A dashboard proposal:

```
OBJECTIVE: <one sentence>
USER: <one persona>
ARCHETYPE: <strategic | analytical | operational>
REFRESH: <cadence>
WIDGETS (5-9):
  1. <name> — type: <chart>, data: <metric>, context: <comparison>
  2. ...
LAYOUT: <grouping rationale>
EXCEPTION COLORING: <what triggers visual emphasis>
DRILLDOWN: <what links off this screen>
```

## Examples

PrimitiveHub's `/registry` page is an analytical dashboard with
strategic flavor — list of primitives + four trust-score columns +
filter sidebar. The Cards | Table toggle is correct because the
analytical user (security reviewer scanning many primitives) needs
table density; the strategic user (executive evaluating which
primitives to install) prefers cards. One surface, two display
modes for two sub-archetypes.

PrimitiveHub's `/validation` page is an operational dashboard:
recent CI runs, exception highlighting on failed stages, drilldown
to per-stage findings. The 10-stage pipeline is the at-a-glance
view; clicking a stage reveals detail.

A future Founder Dashboard would be strategic: 5-7 calm widgets
(total trusted primitives, active orgs, weekly install rate, latest
attestation count, time since last incident). Refresh daily, not
real-time.

## References

- Stephen Few — *Information Dashboard Design* (2nd Ed.)
- Stephen Few — *Show Me the Numbers*
- Companion: [`tufte-data-visualization`](./tufte-data-visualization.md)
- Composition + restraint: [`frontend-design-elite`](./frontend-design-elite.md)

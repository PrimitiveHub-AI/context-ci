# Skill-Consumption Ledger (SK-NNN)

> **Append-only.** One numbered entry per external skill consumed under
> `CLAUDE.md` Hard-rule #6, following the six-step discipline in
> [ADR-0043](./decisions/0043-external-skill-consumption-discipline.md).
> Mirrors the FP-NNN ledger in
> [`false-positive-resolution.md`](./false-positive-resolution.md).
> Never edit a closed entry; correct via a new entry that references it.

**Entry format:**

```
## SK-NNN — <source-repo> → <skill>
- Source:      <url> @ <pinned-commit-sha>
- Requested:   <--skill name>
- phub audit:  <result>
- Whole-tree:  <what the non-context files were + verdict>
- Disposition: merge | new | reject (+ partial-lift)
- Landed in:   <primitive file + version, or "nothing">
- Date:        <YYYY-MM-DD>
- Notes:       <one line>
```

---

## SK-001 — anthropics/skills → frontend-design
- Source:      https://github.com/anthropics/skills @ HEAD (2026-06-08; pre-pinning discipline)
- Requested:   `--skill frontend-design`
- phub audit:  1/1 artifacts clean
- Whole-tree:  only `SKILL.md` (42 lines) + `LICENSE.txt`; no scripts. Manual T1–T10: benign design prose.
- Disposition: merge (signal-only)
- Landed in:   `apps/web/content/primitives/frontend-design-elite.md` v0.2.0 → **0.3.0**
- Date:        2026-06-08
- Notes:       Upstream is a bold-maximalist engine; inverted to our restraint register. Absorbed the AI-slop detector, "intentionality over intensity", the five aesthetic levers, a design-thinking pre-step.

## SK-002 — obra/superpowers → brainstorming
- Source:      https://github.com/obra/superpowers @ HEAD (2026-06-09; pre-pinning discipline)
- Requested:   `--skill brainstorming`
- phub audit:  1/1 artifacts clean **(SKILL.md only)**
- Whole-tree:  ⚠ ships `scripts/server.cjs`, `scripts/start-server.sh`, `scripts/helper.js` — a localhost WebSocket "visual companion". Manually reviewed: node builtins, `127.0.0.1` default, no exfil. **NOT adopted** (executable T5 surface; launcher suggests `--host 0.0.0.0`, violating Hard-rule #3). This is the case that motivated the phub uncovered-surface warning (ADR-0043 §3).
- Disposition: new (methodology only)
- Landed in:   `apps/web/content/primitives/discovery-and-design-discipline.md` v0.1.0 (Mode B)
- Date:        2026-06-09
- Notes:       Re-keyed foreign paths (`docs/superpowers/specs/`, `writing-plans`) → ADRs + PR flow.

## SK-003 — anthropics/knowledge-work-plugins → product-brainstorming
- Source:      https://github.com/anthropics/knowledge-work-plugins @ HEAD (2026-06-09; pre-pinning discipline)
- Requested:   `--skill product-brainstorming`
- phub audit:  1/1 artifacts clean
- Whole-tree:  only `SKILL.md` (273 lines). Benign PM-methodology prose.
- Disposition: merge (into the new primitive from SK-002)
- Landed in:   `apps/web/content/primitives/discovery-and-design-discipline.md` v0.1.0 (Mode A)
- Date:        2026-06-09
- Notes:       Frameworks (HMW, JTBD, OST, First Principles, SCAMPER, OODA, reverse) + Frame→Diverge→Provoke→Converge→Capture arc.

## SK-004 — leonxlnx/taste-skill → minimalist-ui
- Source:      https://github.com/leonxlnx/taste-skill @ `3c7017d636c3a4aad378433ea6d0cfa6c921da4a`
- Requested:   `--skill minimalist-ui` (dir: `skills/minimalist-skill/SKILL.md`)
- phub audit:  1/1 artifacts clean (SKILL.md)
- Whole-tree:  unknown third-party repo (higher risk bar). Whole-tree scan: `skill.sh` (benign path-lookup table), `.github/copilot-instructions.md` (benign auto-loaded agent-instruction file — notable as a *pattern*, not malicious), `research/` prose, images. No exec/fetch/exfil.
- Disposition: **reject (partial-lift)**
- Landed in:   nothing as a primitive — palette + editorial-serif direction conflicts with our dark cyan trust-infra theme, and its restraint doctrine already lives in `frontend-design-elite`. Lifted only net-new concrete motion mechanisms into `framer-motion-discipline.md` (IntersectionObserver-not-scroll-listener; entry-motion timing; staggered-reveal cadence), cited to this SHA.
- Date:        2026-06-09
- Notes:       First reject — proves disposition must be a first-class step (ADR-0043 §1.4).

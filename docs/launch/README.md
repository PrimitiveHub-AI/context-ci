# `docs/launch/`

> Launch artefacts. Pre-positioned. Each file is the source of truth
> for one piece of the launch event. The owner reads them in order
> on launch night.

## Inventory

| Order | File | What |
|---|---|---|
| 1 | [`checklist.md`](./checklist.md) | The launch-night checklist. T-24h, T-1h, T-0, T+1h, T+24h. Every box is either an owner-only flip or its verification. |
| 2 | [`demo-script.md`](./demo-script.md) | The 5-minute demo video shot list. Cold open + 4 acts + wrap. Asset list + take checklist + post-production discipline. |

## Discipline

These documents are **frozen the moment the launch event closes.**
Post-launch changes require a numbered successor (`checklist-v0.2.md`
/ `demo-script-v0.2.md`); the originals stay as the historical
record of what we shipped on the night.

Any new artefact added to this directory rides the same discipline:
versioned filename, no in-place rewrites after the event.

## What's not here

The master rollback procedure lives in Round 8 PR 8.2 (per the
execution-plan ledger). The launch-day runbook from that PR is the
canonical operational document; `checklist.md` here is the
visibility layer over the same flips.

# Context CI Top 10 v0.1 — Scanner Conformance Suite

> The executable contract for the Top 10 detector roster.
> When the spec, the Python implementation, and the TS implementation
> disagree on whether a fixture should fire, the suite arbitrates per
> [ADR-0021](../../decisions/0021-conformance-suite-as-executable-contract.md)
> applied to the scanners.
>
> **Authoritative ADR:** [ADR-0032](../../decisions/0032-scanner-conformance-suite.md)

## Layout

```
docs/context-ci-top-10/conformance/
├── README.md                       (this file)
├── manifest.json                   (per-fixture expectations)
├── clean/                          (negative fixtures — every detector returns INFO)
│   ├── 01-empty.md
│   ├── 02-minimal-primitive.md
│   └── 03-policy-discussion.md
└── fixtures/
    ├── CCI-001/                    (positive fixtures — T1 must fire; others optional)
    │   ├── 01-override.md
    │   ├── 02-role-hijack.md
    │   ├── 03-hidden-instructions.md
    │   └── 04-credential-exfil-hint.md
    ├── CCI-002/                    (positive fixtures — T2 must fire)
    │   ├── 01-zero-width.md
    │   ├── 02-bidi-control.md
    │   └── 03-mixed-script-confusable.md
    ├── CCI-003/                    (positive fixtures — T3 must fire)
    │   ├── 01-long-base64.md
    │   ├── 02-long-hex.md
    │   └── 03-decode-and-execute.md
    ├── CCI-004/                    (positive fixtures — T4 must fire)
    │   ├── 01-fetch-and-include.md
    │   ├── 02-load-time-fetch.md
    │   └── 03-html-import.md
    ├── CCI-005/                    (positive fixtures — T5 must fire)
    │   ├── 01-curl-pipe-bash.md
    │   ├── 02-npx-arbitrary.md
    │   └── 03-install-instruction.md
    └── CCI-006/                    (positive fixtures — T6 must fire)
        ├── 01-send-secrets.md
        ├── 02-curl-data-exfil.md
        └── 03-hide-in-output.md
```

## Manifest

`manifest.json` is the source of truth for what each fixture expects.
Each entry:

```json
{
  "path": "fixtures/CCI-005/01-curl-pipe-bash.md",
  "primary_cci": "CCI-005",
  "expect": "positive",
  "expected_detail_tags": ["shell-pipe-from-network"]
}
```

Schema:

| Field | Type | Required | Notes |
|---|---|---|---|
| `path` | string | yes | Repo-relative path from `docs/context-ci-top-10/conformance/` |
| `primary_cci` | `CCI-NNN` | yes | The detector the fixture is exercising |
| `expect` | `"positive"` \| `"negative"` | yes | `positive` = `primary_cci` detector MUST fire (passed=false). `negative` = MUST NOT fire (passed=true). |
| `expected_detail_tags` | string[] | no (positive only) | Detail tags expected on the verdict's diff hints. If present, MUST be a subset of actual tags. |
| `also_fires` | string[] | no | Other CCI IDs that are ALLOWED to fire on this fixture (e.g. T1 + T6 overlap per Top 10 spec § 7). Detectors not listed here MUST NOT fire. |

## Conformance criterion

A scanner implementation conforms to Top 10 v0.1 if:

1. For every `"expect": "positive"` fixture: the named `primary_cci`
   detector returns `passed=false`. If `expected_detail_tags` is
   present, every listed tag appears in the verdict's diff hints.
2. For every `"expect": "negative"` fixture: every detector returns
   `passed=true`.
3. Optional: detectors NOT listed in `also_fires` on a positive
   fixture also return `passed=true`. (This catches false-positive
   regressions across detectors.)

Both the Python (`apps/api/tests/test_scanner_conformance.py`) and TS
(`packages/phub/test/scanner-conformance.test.ts`) harnesses run the
exact same manifest + fixtures and assert these invariants.

## Per-fixture safety

Fixtures live in markdown files so reviewers can read them. They are
**adversarial example content** — never copy a positive fixture's
body into a real primitive without understanding what it does.

## Adding a new fixture

1. Drop a `.md` file under `fixtures/<CCI-NNN>/` or `clean/`.
2. Add a `manifest.json` entry.
3. Run both harnesses locally:
   - `cd apps/api && uv run pytest tests/test_scanner_conformance.py`
   - `cd packages/phub && pnpm test test/scanner-conformance.test.ts`
4. If either harness fails, fix the discrepancy:
   - **Lockstep rule** (ADR-0023): if the regex needs to change,
     update Python AND TS in the same PR.
   - **Suite-wins rule** (ADR-0021 + ADR-0032): if the spec and
     suite disagree, the suite is the contract.

## Why this suite is small in v0.1

3-4 fixtures per detector is enough to catch the gross regression
("detector stopped firing entirely" / "detector now fires on every
clean file"). Subtle regressions need bigger suites; v0.2 of the
suite expands per-detector fixture counts as the detectors stabilize.
The discipline matters more than the fixture count.

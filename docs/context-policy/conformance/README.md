# Context Policy v0.1 — Conformance Suite

> The executable contract for [Context Policy Language v0.1](../../context-policy-v0.1.md).
> When the spec text and any implementation disagree, the suite
> arbitrates per [ADR-0021](../../decisions/0021-conformance-suite-as-executable-contract.md).

## Layout

```
docs/context-policy/conformance/
├── README.md                  (this file)
├── schema/
│   └── v0.1.json              JSON Schema (Draft 2020-12) for policy YAML
├── valid/
│   ├── 01-minimal-empty-policy.yaml
│   ├── 02-strict-with-no-allows.yaml
│   ├── 03-per-rule-severity-overrides.yaml
│   ├── 04-claude-md-allow-canonical.yaml
│   ├── 05-wildcard-rule-on-threat-model.yaml
│   ├── 06-glob-patterns.yaml
│   ├── 07-cli-equivalent-default.yaml
│   └── 08-multi-allow-composition.yaml
├── invalid/
│   ├── 01-missing-version.yaml
│   ├── 02-wrong-version-string.yaml
│   ├── 03-allow-missing-reason.yaml
│   ├── 04-allow-empty-files.yaml
│   └── 05-reserved-field-extends.yaml
└── scenarios/
    ├── 01-allow-resolves-finding.json
    ├── 02-severity-off-disables-rule.json
    ├── 03-severity-warning-no-strict.json
    ├── 04-strict-mode-promotes-warning.json
    ├── 05-wildcard-rule-id.json
    └── 06-partial-allow-some-survive.json
```

## What each layer tests

| Layer | Tests | Implementations MUST |
|---|---|---|
| `schema/v0.1.json` | Wire format | Validate every policy against this schema before evaluation. |
| `valid/*.yaml` | Schema acceptance | Parse + accept every file. |
| `invalid/*.yaml` | Schema rejection | Reject every file with a descriptive error. |
| `scenarios/*.json` | Evaluation algorithm (spec § 6) | Produce the documented `exitCode`, `suppressedFindingsCount`, `survivingFailVerdicts` for the (policy, verdicts, filename) tuple. |

## Reference implementation

[`packages/phub/src/policy/`](../../../packages/phub/src/policy/)
runs the entire suite as part of its vitest harness. See
[ADR-0018](../../decisions/0018-context-policy-language.md) for the
reference-implementation rule (same model as ADR-0020 for the
verify library): the suite is the floor, this implementation is the
ceiling on v0.1-implemented behavior.

## Conformance criterion

A third-party implementation that:

1. Accepts every `valid/*.yaml` without error,
2. Rejects every `invalid/*.yaml` with an error that mentions the
   specific schema constraint violated,
3. Produces the expected `(exitCode, suppressedFindingsCount,
   survivingFailVerdicts)` tuple for every `scenarios/*.json`,

…may claim "Context Policy Language v0.1 conformance."

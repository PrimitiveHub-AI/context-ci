# Trust Contract v0.1 Conformance Suite

The executable definition of the [Trust Contract v0.1](../../trust-contract-v0.1.md)
wire format. When the spec text and the suite disagree, the suite
wins and the spec gets a clarifying PR (per ADR-0021).

An implementation that passes every test in this suite may claim
**"PrimitiveHub Trust Contract v0.1 conformant"** in its documentation
and marketing. The phrase is reserved for implementations that pass
the suite; we will publicly correct claims that don't.

## Layout

```
docs/trust-contract/conformance/
├── README.md                          (this file)
├── schema/
│   └── v0.1.json                      JSON Schema (Draft 2020-12)
├── valid/                             goldens — implementations MUST accept all
│   ├── 01-minimal-valid.json
│   ├── 02-populated-predicate-all-pass.json
│   ├── 03-predicate-with-warn.json
│   ├── 04-predicate-with-fail.json
│   ├── 05-backend-noop.json
│   ├── 06-backend-staging.json
│   ├── 07-backend-public.json
│   ├── 08-backend-self-hosted.json
│   ├── 09-with-detail-url.json
│   ├── 10-without-detail-url.json
│   ├── 11-unicode-content.json
│   ├── 12-larger-content.json
│   └── _generate_valid_fixtures.py    one-shot deterministic generator
└── invalid/                           adversarial — implementations MUST reject all
    ├── 01-digest-mismatch.json + .md
    ├── 02-unknown-bundle-version.json + .md
    └── 03-unknown-backend.json + .md
```

Every `invalid/*.json` is paired with a `.md` that documents:
- What's wrong with the fixture
- Which verification step is expected to reject it (schema layer vs
  semantic layer)
- The error class the consumer should distinguish

## Running the suite against the reference implementation

The PrimitiveHub reference implementation runs the suite as a
standard pytest module:

```bash
docker compose exec api uv run pytest tests/test_trust_contract_conformance.py -v
```

The harness lives at
[`apps/api/tests/test_trust_contract_conformance.py`](../../../apps/api/tests/test_trust_contract_conformance.py).
The fixture directory is bind-mounted read-only at `/repo/docs/` in the
api container (see `compose.override.yaml`).

## Porting the suite to another language

The JSON fixtures are the portable artifact. An implementer of
`@primitivehub/verify` (TypeScript), a Rust verifier, a Go MCP
server — anyone — should:

1. Load `schema/v0.1.json` as their JSON Schema.
2. For each `valid/*.json`: validate against the schema (MUST pass),
   then run the verification procedure from
   [Trust Contract v0.1 § 7](../../trust-contract-v0.1.md#7-verification-procedure-normative)
   steps 1–2 against it (MUST pass).
3. For each `invalid/*.json`: read the companion `.md` to learn which
   step rejects it; confirm your implementation rejects with a clear
   error at that step.
4. Optionally: feed real bundles produced by your implementation
   through the same schema. If they fail, your implementation is
   non-conformant.

A skeleton harness in TypeScript ships with `@primitivehub/verify`
(Phase 5.5.4, planned). The PrimitiveHub pytest harness is the
reference; ports SHOULD mirror its structure.

## Suite growth schedule

Per [`docs/execution-plan.md`](../../execution-plan.md) Gate G-A:

| Milestone | Floor | Current |
|---|---|---|
| PR 5.5.B (this PR) | ≥10 valid + ≥3 invalid | 12 valid + 3 invalid ✓ |
| End of Week 2 | ≥30 valid + ≥10 invalid | (open) |

Gate G-A doesn't close until end of Week 2. The remaining 18 valid +
7 invalid fixtures land across PRs 5.5.A.bis through Week 2's tail.

## Regenerating the `valid/` fixtures

The `valid/` fixtures are produced by
[`_generate_valid_fixtures.py`](./_generate_valid_fixtures.py).
The generator is deterministic — running it twice produces
byte-identical JSON.

To regenerate (e.g. after the noop backend or schema changes):

```bash
# 1. Copy the generator into the api container's mount (it can only
#    write to /app/, which is apps/api/ on the host).
cp docs/trust-contract/conformance/_generate_valid_fixtures.py \
   apps/api/_gen_conformance.py

# 2. Run it. Outputs go to /app/valid/ → apps/api/valid/ on host.
docker compose exec api python /app/_gen_conformance.py

# 3. Move the regenerated fixtures into the conformance dir.
docker compose exec api chown -R 1000:1000 /app/valid
mv apps/api/valid/*.json docs/trust-contract/conformance/valid/
rmdir apps/api/valid
rm apps/api/_gen_conformance.py
```

A cleaner workflow (a management command or a `tox` recipe) is a
Phase 5.5 follow-up.

## Adding adversarial fixtures

Adversarial fixtures are hand-authored mutations of golden bundles.
For each new `invalid/<n>-<short-name>.json`:

1. Pick a verification step you want to exercise (schema layer or one
   of the 7 semantic steps in Trust Contract v0.1 § 7).
2. Take a golden bundle as the base.
3. Mutate exactly ONE field to break exactly ONE step.
4. Write a companion `.md` that names the step, the expected error
   class, and why the case matters operationally.
5. If the fixture should be rejected by the JSON Schema (vs. by
   semantic verification), add its filename to `_INVALID_AT_SCHEMA`
   in `apps/api/tests/test_trust_contract_conformance.py`.

## References

- [Trust Contract v0.1 spec](../../trust-contract-v0.1.md)
- [ADR-0015](../../decisions/0015-trust-contract-versioning.md) —
  versioning + deprecation policy
- [ADR-0021](../../decisions/0021-conformance-suite-as-executable-contract.md) —
  conformance suite as the executable contract definition
- [`docs/execution-plan.md`](../../execution-plan.md) Gate G-A —
  Standards Lock acceptance criteria

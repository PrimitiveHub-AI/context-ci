"""scanners — Context CI detectors.

Each detector inspects a primitive's content and produces a structured
`Verdict` (pass / warn / fail + diff hints) for one threat category from
`docs/threat-model.md` (T1-T10).

Detectors are stateless pure functions of `DetectorContext → Verdict`,
selected via the `Detector` Protocol (`scanners/protocol.py`). The
factory `scanners.registry.get_all_detectors()` returns the active set;
the Procrastinate sign task runs every detector and records every
verdict in the attestation predicate's `validation[]` block before
signing. The cryptographic attestation thus binds the signer's identity
to ALL detector results, not just pass/fail.

Phase 5 ships the 10 detectors that match the 10 threat categories:
T1 prompt-injection (here), T2 unicode-steg, T3 encoded-payloads,
T4 remote-fetch, T5 unsafe-shell-install, T6 credential-exfil,
T7 typosquatting, T8 fake-citation, T9 copyright-contamination,
T10 context-bloat. PR 5.1 ships the abstraction + T1. The rest of
Phase 5 fills the others on top.

See ADR-0012 for the Protocol rationale.
"""

# Fake-citation threat-class overview

This primitive describes the CCI-008 attack family conceptually. The
family covers adversarial primitives that establish false authority
through invented references or vague appeal-to-authority prose.

Three structural sub-shapes the detector recognises:

- Invalid identifiers: CVE / RFC / arXiv IDs with implausible
  numbers, years outside the publication range, or months out of
  bounds.
- Vague triggers without a paired reference: prose framings
  ("studies show", "research demonstrates", "experts agree") that
  do not co-occur with a verifiable citation marker nearby.
- DOI prefixes outside the registered publisher set.

The agent should treat any claim grounded only in a vague trigger
as unsupported. Verifiable claims accompany identifier metadata that
the agent can independently look up.

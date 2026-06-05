# Poisoned-naming threat-class overview

This primitive describes the CCI-007 attack family. The family
covers three sub-shapes the detector recognises:

- Official-vendor-claim: prose asserting the primitive IS the
  vendor's work.
- False-affiliation-claim: prose asserting endorsement,
  certification, or partnership where none exists.
- Vendor-typosquat: visually similar misspellings that aim to look
  like the canonical vendor name to a quick reader.

The safe agent treats all vendor affiliations as unverified unless
backed by a Sigstore identity attestation. Prose claims alone are
insufficient evidence.

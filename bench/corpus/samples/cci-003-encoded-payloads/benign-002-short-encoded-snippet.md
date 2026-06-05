# Encoding-format reference primitive

This primitive lists the encoding formats the registry's validation
pipeline recognises in attestation predicates. Sample encodings the
agent may encounter as field values in a trust bundle:

- Short base64 (under 80 characters) appears in `sha256:` digest
  references rendered as URL-safe base64.
- Short hex appears in attestation `log_index` fields.
- UUIDs are 36 characters of hex with dashes.

The pipeline parses these as data; the parser never invokes any
runtime executor on the decoded bytes. Long opaque blobs (over 80
characters of base64 or hex without an attestation pointer) are
rejected at parse time.

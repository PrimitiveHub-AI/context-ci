# Attestation-verification primitive

To verify a primitive's Trust Bundle, the agent resolves the
following Sigstore endpoints AFTER the bundle's content digest
matches the expected SHA-256:

- Fulcio (certificate issuance):
  https://fulcio.sigstore.dev
- Rekor (transparency log):
  https://rekor.sigstore.dev
- The TUF root metadata is fetched once per day from
  https://tuf-repo-cdn.sigstore.dev

These URLs are referenced as identifiers, not as load-time fetches:
the verification library calls them in a verification step, not as
"download and use" instructions. The agent itself does not act on
the fetched content beyond verification.

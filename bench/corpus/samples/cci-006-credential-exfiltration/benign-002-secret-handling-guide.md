# Secret-handling guidance primitive

The agent's runtime treats environment variables and dotfile
credentials as opaque material that never leaves the host. The
runtime never includes a credential value in a user-visible response,
never emits a credential to a network endpoint, and never reads a
credential file in service of any downstream pipeline that fans out
the body to an external system.

When a workflow legitimately needs to reference a credential, the
agent passes a reference token (e.g. an OPAQUE_REF token) that the
downstream tool resolves locally. The plaintext credential value is
never serialised into the agent's prompt-response loop.

"""Domain exceptions for the signing pipeline.

We raise these instead of bare RuntimeError so callers (the upload
endpoint, the Procrastinate signing task, the management commands)
can distinguish recoverable failures (transient network on Rekor)
from contract violations (unknown backend, malformed token).
"""

from __future__ import annotations


class SigningError(Exception):
    """Base class for every signing-pipeline failure."""


class UnknownBackendError(SigningError):
    """`SIGSTORE_BACKEND` env var set to a value we don't recognize.

    Raised at startup-ish (first `get_backend()` call). Misconfigured
    deploys fail fast — never silently fall back to the wrong backend.
    """


class BackendConfigurationError(SigningError):
    """A selected backend is missing required configuration.

    Example: SIGSTORE_BACKEND=self-hosted without
    SIGSTORE_SELF_HOSTED_FULCIO_URL. Distinct from `UnknownBackendError`
    because the backend NAME was valid; only its config was incomplete.
    """


class SigningFailedError(SigningError):
    """The underlying sigstore-python call raised, or Rekor was
    unreachable, or the OIDC token was rejected by Fulcio.

    Procrastinate retries on this with exponential backoff (wired
    in Phase 4 PR #3). The original exception is preserved via
    `__cause__` for debugging.
    """


class StatementValidationError(SigningError):
    """The in-toto Statement we built failed structural validation.

    Indicates a programming error in `statement.py` — the user can't
    cause this. Raised loudly so it fails CI/staging, never reaches
    a real Rekor entry.
    """

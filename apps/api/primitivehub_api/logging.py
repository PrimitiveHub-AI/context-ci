"""Single-line JSON log formatter for stdout capture by Docker."""

from __future__ import annotations

import json
import logging
import sys
import traceback
from datetime import UTC, datetime
from typing import Any


class JsonFormatter(logging.Formatter):
    """Format every log record as a single-line JSON object.

    Includes: timestamp, level, logger, message, and any extra fields the
    record carries. Exception tracebacks are folded into a single `exc` field
    so the line stays parseable.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = "".join(traceback.format_exception(*record.exc_info))

        # Surface extra=… fields the caller passed
        for key, value in record.__dict__.items():
            if key in (
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
                "message",
                "taskName",
            ):
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except (TypeError, ValueError):
                payload[key] = repr(value)

        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_stdout() -> None:
    """Force stdout to be line-buffered so logs appear immediately in `docker logs`."""
    sys.stdout.reconfigure(line_buffering=True)  # type: ignore[union-attr]
    sys.stderr.reconfigure(line_buffering=True)  # type: ignore[union-attr]

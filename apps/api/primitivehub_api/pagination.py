"""Cursor-based pagination helper.

Cursor pagination (vs offset+limit) is stable under concurrent inserts: it
doesn't skip rows when new ones land between requests, and it doesn't
duplicate rows when an in-page row gets deleted. The cost is no random-page
access — which the marketplace doesn't need anyway.

Cursor encoding: base64(JSON({"ts": <iso>, "id": <uuid>})). The cursor
captures the trailing edge of the current page (the oldest row's
created_at + id) so the next page filters `created_at < ts` or
`(created_at = ts AND id < uuid)`. This stable tie-breaker handles ties
in `created_at` correctly without losing rows.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Generic, TypeVar

from django.db.models import Q, QuerySet
from ninja import Schema

T = TypeVar("T")

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


@dataclass(frozen=True)
class Cursor:
    """Opaque trailing-edge cursor over (created_at, id)."""

    ts: datetime
    id: str

    def encode(self) -> str:
        payload = json.dumps({"ts": self.ts.isoformat(), "id": self.id})
        return base64.urlsafe_b64encode(payload.encode()).decode()

    @classmethod
    def decode(cls, token: str) -> "Cursor | None":
        try:
            payload = json.loads(base64.urlsafe_b64decode(token.encode()).decode())
            return cls(ts=datetime.fromisoformat(payload["ts"]), id=str(payload["id"]))
        except (ValueError, KeyError, json.JSONDecodeError):
            return None


class Page(Schema, Generic[T]):
    """A page of results plus an optional `next_cursor` for the next page."""

    items: list[T]
    next_cursor: str | None = None
    page_size: int


def paginate(
    queryset: QuerySet,
    *,
    cursor: str | None = None,
    page_size: int | None = None,
    order_field: str = "created_at",
) -> tuple[list, str | None, int]:
    """Apply cursor pagination to a queryset.

    Returns (items, next_cursor, effective_page_size). The caller serializes
    `items` into output schemas before returning to the client.

    The queryset must be ordered DESC by (order_field, id) — cursor walks the
    trailing edge of the descending order. We enforce the ordering here so
    callers can't drift.
    """
    size = min(page_size or DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    queryset = queryset.order_by(f"-{order_field}", "-id")

    if cursor:
        decoded = Cursor.decode(cursor)
        if decoded is None:
            # Invalid cursor → treat as no cursor. Client can recover.
            decoded = None
        else:
            queryset = queryset.filter(
                Q(**{f"{order_field}__lt": decoded.ts})
                | Q(**{order_field: decoded.ts, "id__lt": decoded.id})
            )

    # Fetch size+1 to detect whether there's another page without a count() query.
    rows = list(queryset[: size + 1])
    has_next = len(rows) > size
    items = rows[:size]

    next_cursor: str | None = None
    if has_next and items:
        last = items[-1]
        next_cursor = Cursor(
            ts=getattr(last, order_field),
            id=str(last.id),
        ).encode()

    return items, next_cursor, size

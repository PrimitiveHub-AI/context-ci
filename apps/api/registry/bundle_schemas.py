"""Bundle schemas — mirror apps/web/lib/types.ts:Bundle.

Lives in `registry` (Bundle model is in `registry/models.py`). Imported
from registry/api.py for the bundles endpoints; kept in a separate file
so the existing schemas.py stays focused on the primitive surface.
"""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — Pydantic needs runtime access

from registry.schemas import CamelSchema


class BundleOut(CamelSchema):
    """Mirrors `apps/web/lib/types.ts:Bundle`."""

    slug: str
    name: str
    description: str
    primitives: list[str]
    total_tokens: int
    total_budget: int
    compatible_agents: list[str]
    quality_average: int
    use_case: str
    install_command: str
    downloads: int = 0
    created_at: datetime

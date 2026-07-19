"""Reusable sort-parameter parsing for list endpoints (see api_contract.md).

Parses a comma-separated ``sort`` string (``-field`` = descending) against a
whitelist of allowed columns, ignores unknown fields, and falls back to a
default ordering when nothing valid is provided.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def build_order_by(sort: str | None, allowed: Mapping[str, Any], *, default: Any) -> list[Any]:
    clauses: list[Any] = []
    for raw in (sort or "").split(","):
        field = raw.strip()
        if not field:
            continue
        descending = field.startswith("-")
        column = allowed.get(field[1:] if descending else field)
        if column is None:
            continue
        clauses.append(column.desc() if descending else column.asc())
    return clauses or [default]

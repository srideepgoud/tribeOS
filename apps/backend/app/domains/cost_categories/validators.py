"""Cost Category field normalization (ADR 0007 — pure shaping only)."""

from __future__ import annotations

from typing import Any


def normalize_cost_category_fields(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)

    if isinstance(normalized.get("name"), str):
        normalized["name"] = normalized["name"].strip()

    return normalized

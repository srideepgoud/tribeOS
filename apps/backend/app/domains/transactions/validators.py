"""Transaction field normalization (ADR 0007 — pure shaping only)."""

from __future__ import annotations

from typing import Any

_OPTIONAL_STR_FIELDS = ("reference_number", "remarks")


def normalize_transaction_fields(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)

    for field in _OPTIONAL_STR_FIELDS:
        if field not in normalized or normalized[field] is None:
            continue
        value = str(normalized[field]).strip()
        normalized[field] = value or None

    return normalized

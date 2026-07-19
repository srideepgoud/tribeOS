"""Event field normalization used by the service before persistence.

Pure shaping only (ADR 0007) — no I/O, no business rules.
"""

from __future__ import annotations

from typing import Any

_OPTIONAL_STR_FIELDS = ("venue", "city", "notes")


def normalize_event_fields(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)

    if isinstance(normalized.get("name"), str):
        normalized["name"] = normalized["name"].strip()

    for field in _OPTIONAL_STR_FIELDS:
        if field not in normalized or normalized[field] is None:
            continue
        value = str(normalized[field]).strip()
        normalized[field] = value or None

    return normalized

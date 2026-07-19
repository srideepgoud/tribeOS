"""Client field normalization used by the service before persistence.

Keeps stored data consistent (trimmed strings, blank optionals stored as NULL,
lowercased email). Only keys present in the payload are processed, so this is
safe for partial (PATCH) updates.
"""

from __future__ import annotations

from typing import Any

_OPTIONAL_STR_FIELDS = ("gst_number", "phone", "email", "billing_address", "notes")


def normalize_client_fields(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)

    if isinstance(normalized.get("company_name"), str):
        normalized["company_name"] = normalized["company_name"].strip()

    for field in _OPTIONAL_STR_FIELDS:
        if field not in normalized or normalized[field] is None:
            continue
        value = str(normalized[field]).strip()
        if field == "email":
            value = value.lower()
        # Store blank optional strings as NULL rather than "".
        normalized[field] = value or None

    return normalized

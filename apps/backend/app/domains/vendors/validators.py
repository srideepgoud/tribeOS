"""Vendor field normalization (ADR 0007 — pure shaping only)."""

from __future__ import annotations

from typing import Any

_OPTIONAL_STR_FIELDS = (
    "contact_name",
    "phone",
    "email",
    "gst_number",
    "pan_number",
    "bank_name",
    "account_number",
    "ifsc",
    "notes",
)


def normalize_vendor_fields(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)

    if isinstance(normalized.get("company_name"), str):
        normalized["company_name"] = normalized["company_name"].strip()

    for field in _OPTIONAL_STR_FIELDS:
        if field not in normalized or normalized[field] is None:
            continue
        value = str(normalized[field]).strip()
        if field == "email":
            value = value.lower()
        if field in ("gst_number", "pan_number", "ifsc"):
            value = value.upper()
        normalized[field] = value or None

    return normalized

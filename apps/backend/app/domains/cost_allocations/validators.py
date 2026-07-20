"""Pure field normalization for Cost Allocations (ADR 0007). No I/O."""

from __future__ import annotations

from decimal import Decimal
from typing import Any


def normalize_allocation_line(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize a single allocation line dict."""
    out = dict(data)
    if "allocated_amount" in out and out["allocated_amount"] is not None:
        out["allocated_amount"] = Decimal(str(out["allocated_amount"]))
    return out


def normalize_allocation_lines(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_allocation_line(line) for line in lines]

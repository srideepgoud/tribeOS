"""Replaceable invoice-number strategy (ADR 0013).

``ClientInvoiceService`` must call ``generate_invoice_number`` rather than
inlining a format string, so year-based / branch-prefixed schemes can replace
this module later without touching commercial invariants.
"""

from __future__ import annotations

import uuid


def generate_invoice_number() -> str:
    """System-generated, globally unique, immutable display number (v1)."""
    return f"INV-{uuid.uuid4().hex[:12].upper()}"

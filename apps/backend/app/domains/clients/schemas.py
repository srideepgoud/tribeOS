"""Pydantic request/response schemas for the Clients API.

These are the API boundary contracts; business rules live in ``service.py`` and
``validators.py``. Field-level failures surface as ``422 VALIDATION_ERROR`` per
``docs/api_contract.md``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClientCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Client name is mandatory (business_rules.md — Client Rules).
    company_name: str = Field(min_length=1, max_length=255)
    gst_number: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    billing_address: str | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    gst_number: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    billing_address: str | None = None
    notes: str | None = None


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    gst_number: str | None
    phone: str | None
    email: str | None
    billing_address: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

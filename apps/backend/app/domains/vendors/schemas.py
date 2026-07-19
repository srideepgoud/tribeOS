"""Pydantic schemas for the Vendors API."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class VendorCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    gst_number: str | None = Field(default=None, max_length=32)
    pan_number: str | None = Field(default=None, max_length=32)
    bank_name: str | None = Field(default=None, max_length=255)
    account_number: str | None = Field(default=None, max_length=64)
    ifsc: str | None = Field(default=None, max_length=32)
    notes: str | None = None


class VendorUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    gst_number: str | None = Field(default=None, max_length=32)
    pan_number: str | None = Field(default=None, max_length=32)
    bank_name: str | None = Field(default=None, max_length=255)
    account_number: str | None = Field(default=None, max_length=64)
    ifsc: str | None = Field(default=None, max_length=32)
    notes: str | None = None


class VendorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    contact_name: str | None
    phone: str | None
    email: str | None
    gst_number: str | None
    pan_number: str | None
    bank_name: str | None
    account_number: str | None
    ifsc: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

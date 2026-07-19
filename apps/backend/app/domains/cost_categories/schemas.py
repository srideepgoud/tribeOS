"""Pydantic schemas for the Cost Categories API."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CostCategoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID
    name: str = Field(min_length=1, max_length=255)
    display_order: int = Field(default=0, ge=0)


class CostCategoryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    event_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    display_order: int | None = Field(default=None, ge=0)


class CostCategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_id: uuid.UUID
    name: str
    display_order: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None

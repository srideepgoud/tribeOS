"""Cost Item business logic: lifecycle, budget policy, commercial versioning.

Budget immutability after Approved (Phase 4 — approvals deferred).
Version creation only when ``budget_amount`` / ``negotiated_amount`` change.
``actual_amount`` is never client-writable (ADR 0008).
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_categories.repository import CostCategoryRepository
from app.domains.cost_items.models import (
    CostItem,
    CostItemStatus,
    CostItemVersion,
    ExpenseType,
)
from app.domains.cost_items.repository import CostItemRepository
from app.domains.cost_items.schemas import CostItemCreate, CostItemUpdate
from app.domains.cost_items.validators import normalize_cost_item_fields
from app.domains.events.models import EventStatus
from app.domains.events.repository import EventRepository
from app.shared.errors import DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

ALLOWED_TRANSITIONS: dict[CostItemStatus, set[CostItemStatus]] = {
    CostItemStatus.PLANNED: {CostItemStatus.APPROVED, CostItemStatus.CANCELLED},
    CostItemStatus.APPROVED: {CostItemStatus.IN_PROGRESS, CostItemStatus.CANCELLED},
    CostItemStatus.IN_PROGRESS: {CostItemStatus.COMPLETED},
    CostItemStatus.COMPLETED: set(),
    CostItemStatus.CANCELLED: set(),
}

_READ_ONLY = frozenset({CostItemStatus.COMPLETED, CostItemStatus.CANCELLED})
_BUDGET_FROZEN = frozenset(
    {
        CostItemStatus.APPROVED,
        CostItemStatus.IN_PROGRESS,
        CostItemStatus.COMPLETED,
        CostItemStatus.CANCELLED,
    }
)
_COMMERCIAL_FIELDS = frozenset({"budget_amount", "negotiated_amount"})


class CostItemService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = CostItemRepository(session)
        self._events = EventRepository(session)
        self._categories = CostCategoryRepository(session)

    async def get(self, item_id: uuid.UUID) -> CostItem:
        return await self._repo.get_required(item_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        event_id: uuid.UUID | None = None,
        category_id: uuid.UUID | None = None,
        status: CostItemStatus | None = None,
    ) -> tuple[Sequence[CostItem], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            event_id=event_id,
            category_id=category_id,
            status=status,
        )

    async def list_versions(self, item_id: uuid.UUID) -> Sequence[CostItemVersion]:
        await self.get(item_id)
        return await self._repo.list_versions(item_id)

    async def create(self, payload: CostItemCreate, *, actor: uuid.UUID | None = None) -> CostItem:
        data = normalize_cost_item_fields(payload.model_dump())
        await self._require_non_archived_event(data["event_id"])
        await self._require_category_on_event(data["category_id"], data["event_id"])
        self._assert_expense_vendor_rules(data["expense_type"], data.get("vendor_required", False))

        item = CostItem(
            **data,
            actual_amount=None,
            status=CostItemStatus.PLANNED,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(item)
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def update(
        self, item_id: uuid.UUID, payload: CostItemUpdate, *, actor: uuid.UUID | None = None
    ) -> CostItem:
        """Field updates only. Never changes ``status`` or ``actual_amount``."""
        item = await self.get(item_id)
        self._assert_mutable(item)

        changes = normalize_cost_item_fields(
            payload.model_dump(exclude_unset=True, exclude={"status"})
        )
        if not changes:
            return item

        commercial_requested = _COMMERCIAL_FIELDS & changes.keys()
        if commercial_requested and item.status in _BUDGET_FROZEN:
            raise InvalidStateError("Budget values are immutable once the Cost Item is Approved.")

        event_id = changes.get("event_id", item.event_id)
        category_id = changes.get("category_id", item.category_id)
        if "event_id" in changes:
            await self._require_non_archived_event(event_id)
        if "event_id" in changes or "category_id" in changes:
            await self._require_category_on_event(category_id, event_id)

        expense_type = changes.get("expense_type", item.expense_type)
        vendor_required = changes.get("vendor_required", item.vendor_required)
        if "expense_type" in changes or "vendor_required" in changes:
            self._assert_expense_vendor_rules(expense_type, vendor_required)

        needs_version = False
        if "budget_amount" in changes and changes["budget_amount"] != item.budget_amount:
            needs_version = True
        if (
            "negotiated_amount" in changes
            and changes["negotiated_amount"] != item.negotiated_amount
        ):
            needs_version = True

        if needs_version:
            await self._snapshot_version(item, actor=actor, reason="Commercial values updated")

        for field, value in changes.items():
            setattr(item, field, value)
        item.updated_by = actor
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def transition_status(
        self,
        item_id: uuid.UUID,
        new_status: CostItemStatus,
        *,
        actor: uuid.UUID | None = None,
    ) -> CostItem:
        item = await self.get(item_id)
        current = item.status
        if new_status == current:
            return item

        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise InvalidStateError(
                f"Cannot transition Cost Item from {current.value} to {new_status.value}."
            )

        item.status = new_status
        item.updated_by = actor
        await self._session.commit()
        await self._session.refresh(item)
        return item

    async def archive(self, item_id: uuid.UUID, *, actor: uuid.UUID | None = None) -> None:
        """Soft delete. Financial-activity guard deferred until Transactions exist."""
        item = await self.get(item_id)
        if item.status in _READ_ONLY:
            raise InvalidStateError("Completed or Cancelled Cost Items cannot be archived.")
        if item.archived_at is None:
            item.archived_at = datetime.now(UTC)
            item.updated_by = actor
            await self._session.commit()

    def _assert_mutable(self, item: CostItem) -> None:
        if item.status == CostItemStatus.COMPLETED:
            raise InvalidStateError("Completed Cost Items cannot be modified.")
        if item.status == CostItemStatus.CANCELLED:
            raise InvalidStateError("Cancelled Cost Items cannot be modified.")

    async def _require_non_archived_event(self, event_id: uuid.UUID) -> None:
        event = await self._events.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError(
                "Cost Items cannot be modified after Financial Close (Event Closed)."
            )
        if event.status == EventStatus.CANCELLED:
            raise InvalidStateError(
                "Cost Items cannot be modified while the Event is Cancelled."
            )

    async def _require_category_on_event(self, category_id: uuid.UUID, event_id: uuid.UUID) -> None:
        category = await self._categories.get_by_id(category_id)
        if category is None:
            raise NotFoundError("Cost Category not found.")
        if category.event_id != event_id:
            raise DomainValidationError(
                "Cost Category must belong to the same Event as the Cost Item."
            )

    @staticmethod
    def _assert_expense_vendor_rules(expense_type: ExpenseType, vendor_required: bool) -> None:
        if expense_type == ExpenseType.INTERNAL and vendor_required:
            raise DomainValidationError("Internal expenses never require a Vendor Work Order.")

    async def _snapshot_version(
        self,
        item: CostItem,
        *,
        actor: uuid.UUID | None,
        reason: str,
    ) -> None:
        version_number = await self._repo.next_version_number(item.id)
        version = CostItemVersion(
            cost_item_id=item.id,
            version_number=version_number,
            budget_amount=item.budget_amount,
            negotiated_amount=item.negotiated_amount,
            actual_amount=item.actual_amount,
            change_reason=reason,
            changed_by=actor,
            changed_at=datetime.now(UTC),
        )
        await self._repo.add_version(version)

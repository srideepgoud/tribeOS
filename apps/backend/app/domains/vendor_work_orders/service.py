"""Vendor Work Order business logic: lifecycle, commercial lock, invariants.

Phase 6 locked decisions govern active statuses, commercial editability, and
numbering. Approvals / PO PDF / payments are deferred.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.cost_items.models import CostItem, ExpenseType
from app.domains.cost_items.repository import CostItemRepository
from app.domains.events.models import EventStatus
from app.domains.events.repository import EventRepository
from app.domains.vendor_work_orders.models import VendorWorkOrder, VendorWorkOrderStatus
from app.domains.vendor_work_orders.repository import VendorWorkOrderRepository
from app.domains.vendor_work_orders.schemas import VendorWorkOrderCreate, VendorWorkOrderUpdate
from app.domains.vendor_work_orders.validators import normalize_vendor_work_order_fields
from app.domains.vendors.repository import VendorRepository
from app.shared.errors import ConflictError, DomainValidationError, InvalidStateError, NotFoundError
from app.shared.pagination import PageParams

ALLOWED_TRANSITIONS: dict[VendorWorkOrderStatus, set[VendorWorkOrderStatus]] = {
    VendorWorkOrderStatus.DRAFT: {
        VendorWorkOrderStatus.APPROVED,
        VendorWorkOrderStatus.CANCELLED,
    },
    VendorWorkOrderStatus.APPROVED: {
        VendorWorkOrderStatus.ISSUED,
        VendorWorkOrderStatus.CANCELLED,
    },
    VendorWorkOrderStatus.ISSUED: {VendorWorkOrderStatus.IN_PROGRESS},
    VendorWorkOrderStatus.IN_PROGRESS: {VendorWorkOrderStatus.COMPLETED},
    VendorWorkOrderStatus.COMPLETED: set(),
    VendorWorkOrderStatus.CANCELLED: set(),
}

# Commercial fields editable through Approved; immutable from Issued onward.
_COMMERCIAL_LOCKED = frozenset(
    {
        VendorWorkOrderStatus.ISSUED,
        VendorWorkOrderStatus.IN_PROGRESS,
        VendorWorkOrderStatus.COMPLETED,
        VendorWorkOrderStatus.CANCELLED,
    }
)

_COMMERCIAL_FIELDS = frozenset(
    {"vendor_id", "scope", "agreed_amount", "issue_date", "expected_completion"}
)


def generate_work_order_number() -> str:
    """System-generated, globally unique, immutable display number."""
    return f"WO-{uuid.uuid4().hex[:12].upper()}"


class VendorWorkOrderService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = VendorWorkOrderRepository(session)
        self._vendors = VendorRepository(session)
        self._cost_items = CostItemRepository(session)
        self._events = EventRepository(session)

    async def get(self, work_order_id: uuid.UUID) -> VendorWorkOrder:
        return await self._repo.get_required(work_order_id)

    async def list(
        self,
        *,
        page: PageParams,
        q: str | None,
        sort: str | None,
        vendor_id: uuid.UUID | None = None,
        cost_item_id: uuid.UUID | None = None,
        status: VendorWorkOrderStatus | None = None,
    ) -> tuple[Sequence[VendorWorkOrder], int]:
        return await self._repo.list_paginated(
            q=q,
            sort=sort,
            offset=page.offset,
            limit=page.limit,
            vendor_id=vendor_id,
            cost_item_id=cost_item_id,
            status=status,
        )

    async def create(
        self, payload: VendorWorkOrderCreate, *, actor: uuid.UUID | None = None
    ) -> VendorWorkOrder:
        data = normalize_vendor_work_order_fields(payload.model_dump())
        await self._require_non_archived_vendor(data["vendor_id"])
        cost_item = await self._require_vendor_cost_item(data["cost_item_id"])
        await self._assert_event_financially_mutable(cost_item.event_id)
        await self._assert_no_active_work_order(data["cost_item_id"])

        agreed = data.get("agreed_amount")
        if agreed is None:
            agreed = cost_item.negotiated_amount
            if agreed is None:
                agreed = cost_item.budget_amount
        if agreed is None:
            raise DomainValidationError(
                "agreed_amount is required when the Cost Item has no Negotiated Cost."
            )

        work_order = VendorWorkOrder(
            cost_item_id=data["cost_item_id"],
            vendor_id=data["vendor_id"],
            work_order_number=generate_work_order_number(),
            scope=data.get("scope"),
            agreed_amount=Decimal(agreed),
            issue_date=data.get("issue_date"),
            expected_completion=data.get("expected_completion"),
            version=1,
            status=VendorWorkOrderStatus.DRAFT,
            created_by=actor,
            updated_by=actor,
        )
        await self._repo.add(work_order)
        await self._session.commit()
        await self._session.refresh(work_order)
        return work_order

    async def update(
        self,
        work_order_id: uuid.UUID,
        payload: VendorWorkOrderUpdate,
        *,
        actor: uuid.UUID | None = None,
    ) -> VendorWorkOrder:
        """Field updates only. Never changes ``status``, ``work_order_number``, or ``version``."""
        work_order = await self.get(work_order_id)
        cost_item = await self._require_vendor_cost_item(work_order.cost_item_id)
        await self._assert_event_financially_mutable(cost_item.event_id)
        self._assert_commercially_mutable(work_order)

        changes = normalize_vendor_work_order_fields(
            payload.model_dump(exclude_unset=True, exclude={"status"})
        )
        if not changes:
            return work_order

        commercial_requested = _COMMERCIAL_FIELDS & changes.keys()
        if commercial_requested and work_order.status in _COMMERCIAL_LOCKED:
            raise InvalidStateError(
                "Commercial fields are immutable once the Vendor Work Order is Issued."
            )

        if "vendor_id" in changes:
            await self._require_non_archived_vendor(changes["vendor_id"])

        for field, value in changes.items():
            setattr(work_order, field, value)
        work_order.updated_by = actor
        await self._session.commit()
        await self._session.refresh(work_order)
        return work_order

    async def transition_status(
        self,
        work_order_id: uuid.UUID,
        new_status: VendorWorkOrderStatus,
        *,
        actor: uuid.UUID | None = None,
    ) -> VendorWorkOrder:
        work_order = await self.get(work_order_id)
        cost_item = await self._cost_items.get_by_id(work_order.cost_item_id)
        if cost_item is None:
            raise NotFoundError("Cost Item not found.")
        await self._assert_event_financially_mutable(cost_item.event_id)
        current = work_order.status
        if new_status == current:
            return work_order

        allowed = ALLOWED_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise InvalidStateError(
                f"Cannot transition Vendor Work Order from {current.value} to {new_status.value}."
            )

        work_order.status = new_status
        work_order.updated_by = actor
        await self._session.commit()
        await self._session.refresh(work_order)
        return work_order

    def _assert_commercially_mutable(self, work_order: VendorWorkOrder) -> None:
        if work_order.status == VendorWorkOrderStatus.COMPLETED:
            raise InvalidStateError("Completed Vendor Work Orders cannot be modified.")
        if work_order.status == VendorWorkOrderStatus.CANCELLED:
            raise InvalidStateError("Cancelled Vendor Work Orders cannot be modified.")
        if work_order.status in _COMMERCIAL_LOCKED:
            raise InvalidStateError(
                "Commercial fields are immutable once the Vendor Work Order is Issued."
            )

    async def _assert_event_financially_mutable(self, event_id: uuid.UUID) -> None:
        event = await self._events.get_by_id(event_id)
        if event is None:
            raise NotFoundError("Event not found.")
        if event.status == EventStatus.CLOSED:
            raise InvalidStateError(
                "Vendor Work Orders cannot be modified after Financial Close (Event Closed)."
            )
        if event.status == EventStatus.CANCELLED:
            raise InvalidStateError(
                "Vendor Work Orders cannot be modified while the Event is Cancelled."
            )

    async def _require_non_archived_vendor(self, vendor_id: uuid.UUID) -> None:
        vendor = await self._vendors.get_by_id(vendor_id)
        if vendor is None:
            raise NotFoundError("Vendor not found.")

    async def _require_vendor_cost_item(self, cost_item_id: uuid.UUID) -> CostItem:
        cost_item = await self._cost_items.get_by_id(cost_item_id)
        if cost_item is None:
            raise NotFoundError("Cost Item not found.")
        if cost_item.expense_type != ExpenseType.VENDOR:
            raise DomainValidationError(
                "Vendor Work Orders may only be created for Vendor-type Cost Items."
            )
        return cost_item

    async def _assert_no_active_work_order(self, cost_item_id: uuid.UUID) -> None:
        count = await self._repo.count_active_by_cost_item(cost_item_id)
        if count > 0:
            raise ConflictError("This Cost Item already has an active Vendor Work Order.")

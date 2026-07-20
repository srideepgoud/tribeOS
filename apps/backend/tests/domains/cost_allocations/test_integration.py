"""End-to-end Cost Allocation financial workflow tests (ADR 0012)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_allocations.models import AttributionState
from app.domains.cost_allocations.repository import CostAllocationRepository
from app.domains.cost_allocations.schemas import CostAllocationLine, CostAllocationReplace
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.finance.financial_summary import FinancialSummaryService
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType
from app.domains.transactions.schemas import TransactionCreate
from app.domains.transactions.service import TransactionService
from app.shared.errors import DomainValidationError, InvalidStateError


async def _seed(session: AsyncSession) -> dict:
    client = await ClientService(session).create(ClientCreate(company_name="Festival Co"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Fest"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Production")
    )
    stage = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Stage",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("400000.00"),
        )
    )
    lighting = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Lighting",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("200000.00"),
        )
    )
    return {"event": event, "stage": stage, "lighting": lighting, "category": category}


async def test_complete_auto_allocates_and_updates_actual(
    db_session: AsyncSession,
) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["stage"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.UPI,
            amount=Decimal("300000.00"),
            transaction_date=date(2026, 7, 1),
        )
    )
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    allocations = await service.list_allocations(txn.id)
    assert len(allocations) == 1
    assert allocations[0].allocated_amount == Decimal("300000.00")
    assert allocations[0].cost_item_id == seed["stage"].id
    item = await CostItemService(db_session).get(seed["stage"].id)
    assert item.actual_amount == Decimal("300000.00")
    summary = await service.get_attribution_summary(txn.id)
    assert summary.state == AttributionState.FULLY_ATTRIBUTED


async def test_shared_allocations_update_both_actuals(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("800000.00"),
            transaction_date=date(2026, 7, 2),
            allocations=[
                CostAllocationLine(
                    cost_item_id=seed["stage"].id, allocated_amount=Decimal("400000.00")
                ),
                CostAllocationLine(
                    cost_item_id=seed["lighting"].id, allocated_amount=Decimal("400000.00")
                ),
            ],
        )
    )
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    stage = await CostItemService(db_session).get(seed["stage"].id)
    lighting = await CostItemService(db_session).get(seed["lighting"].id)
    assert stage.actual_amount == Decimal("400000.00")
    assert lighting.actual_amount == Decimal("400000.00")
    fin = await FinancialSummaryService(db_session).for_event(seed["event"].id)
    assert fin.cash_spent == Decimal("800000.00")
    assert fin.attributed_cost == Decimal("800000.00")
    assert fin.unattributed_spend == Decimal("0.00")


async def test_reversal_leaves_allocations_untouched_and_reduces_actual(
    db_session: AsyncSession,
) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["stage"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 3),
        )
    )
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    before = await service.list_allocations(txn.id)
    assert len(before) == 1
    alloc_id = before[0].id
    await service.transition_status(txn.id, TransactionStatus.REVERSED)
    after = await CostAllocationRepository(db_session).list_by_transaction(txn.id)
    assert len(after) == 1
    assert after[0].id == alloc_id
    assert after[0].allocated_amount == Decimal("10000.00")
    item = await CostItemService(db_session).get(seed["stage"].id)
    assert item.actual_amount == Decimal("0.00")


async def test_closed_event_rejects_allocation_replace(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["stage"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("5000.00"),
            transaction_date=date(2026, 7, 4),
        )
    )
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)

    events = EventService(db_session)
    for status in (
        EventStatus.PLANNING,
        EventStatus.COMMERCIALS,
        EventStatus.PROCUREMENT,
        EventStatus.EXECUTION,
        EventStatus.SETTLEMENT,
        EventStatus.CLOSED,
    ):
        await events.transition_status(seed["event"].id, status)

    with pytest.raises(InvalidStateError):
        await service.replace_allocations(
            txn.id,
            CostAllocationReplace(
                allocations=[
                    CostAllocationLine(
                        cost_item_id=seed["stage"].id, allocated_amount=Decimal("5000.00")
                    )
                ]
            ),
        )


async def test_partial_attribution_and_over_allocate(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["stage"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 5),
        )
    )
    await service.replace_allocations(
        txn.id,
        CostAllocationReplace(
            allocations=[
                CostAllocationLine(
                    cost_item_id=seed["stage"].id, allocated_amount=Decimal("4000.00")
                )
            ]
        ),
    )
    summary = await service.get_attribution_summary(txn.id)
    assert summary.state == AttributionState.PARTIALLY_ATTRIBUTED

    with pytest.raises(DomainValidationError):
        await service.replace_allocations(
            txn.id,
            CostAllocationReplace(
                allocations=[
                    CostAllocationLine(
                        cost_item_id=seed["stage"].id, allocated_amount=Decimal("6000.00")
                    ),
                    CostAllocationLine(
                        cost_item_id=seed["lighting"].id, allocated_amount=Decimal("5000.00")
                    ),
                ]
            ),
        )


async def test_unattributed_spend_visible_in_summary(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("15000.00"),
            transaction_date=date(2026, 7, 6),
        )
    )
    # Complete without cost_item_id and without allocations → remains unattributed.
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    assert await service.list_allocations(txn.id) == []
    fin = await FinancialSummaryService(db_session).for_event(seed["event"].id)
    assert fin.cash_spent == Decimal("15000.00")
    assert fin.attributed_cost == Decimal("0.00")
    assert fin.unattributed_spend == Decimal("15000.00")

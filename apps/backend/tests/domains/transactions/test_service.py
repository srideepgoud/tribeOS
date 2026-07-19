"""TransactionService tests — lifecycle, immutability, actuals, reversal."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.models import EventStatus
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType
from app.domains.transactions.repository import TransactionRepository
from app.domains.transactions.schemas import TransactionCreate, TransactionUpdate
from app.domains.transactions.service import TransactionService
from app.domains.vendor_work_orders.schemas import VendorWorkOrderCreate
from app.domains.vendor_work_orders.service import VendorWorkOrderService
from app.domains.vendors.schemas import VendorCreate
from app.domains.vendors.service import VendorService
from app.shared.errors import DomainValidationError, InvalidStateError
from app.shared.pagination import PageParams


async def _seed(session: AsyncSession) -> dict:
    client = await ClientService(session).create(ClientCreate(company_name="Acme"))
    event = await EventService(session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(session).create(
        CostCategoryCreate(event_id=event.id, name="Audio")
    )
    vendor_item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="PA System",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("50000.00"),
            negotiated_amount=Decimal("45000.00"),
            vendor_required=True,
        )
    )
    internal_item = await CostItemService(session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Staff meals",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("5000.00"),
        )
    )
    vendor = await VendorService(session).create(VendorCreate(company_name="Audio Pro"))
    wo = await VendorWorkOrderService(session).create(
        VendorWorkOrderCreate(cost_item_id=vendor_item.id, vendor_id=vendor.id)
    )
    return {
        "event": event,
        "vendor_item": vendor_item,
        "internal_item": internal_item,
        "work_order": wo,
    }


async def test_vendor_payment_complete_and_actuals(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["vendor_item"].id,
            work_order_id=seed["work_order"].id,
            transaction_type=TransactionType.VENDOR_PAYMENT,
            payment_method=PaymentMethod.UPI,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 1),
        )
    )
    assert txn.status == TransactionStatus.PENDING

    completed = await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    assert completed.status == TransactionStatus.COMPLETED
    item = await CostItemService(db_session).get(seed["vendor_item"].id)
    assert item.actual_amount == Decimal("10000.00")

    with pytest.raises(InvalidStateError):
        await service.update(txn.id, TransactionUpdate(amount=Decimal("1.00")))


async def test_reversal_recomputes_actuals(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["vendor_item"].id,
            work_order_id=seed["work_order"].id,
            transaction_type=TransactionType.VENDOR_PAYMENT,
            payment_method=PaymentMethod.BANK_TRANSFER,
            amount=Decimal("10000.00"),
            transaction_date=date(2026, 7, 1),
        )
    )
    await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    reversed_txn = await service.transition_status(txn.id, TransactionStatus.REVERSED)
    assert reversed_txn.status == TransactionStatus.REVERSED
    assert reversed_txn.amount == Decimal("10000.00")

    reversals, total = await service.list(
        page=PageParams(page=1, page_size=20),
        q=None,
        sort=None,
        transaction_type=TransactionType.REVERSAL,
    )
    assert total == 1
    assert reversals[0].amount == Decimal("-10000.00")
    assert reversals[0].status == TransactionStatus.COMPLETED
    assert reversals[0].reverses_transaction_id == txn.id

    item = await CostItemService(db_session).get(seed["vendor_item"].id)
    assert item.actual_amount == Decimal("0.00")

    # Idempotent: same status is a no-op; still only one reversal row.
    again = await service.transition_status(txn.id, TransactionStatus.REVERSED)
    assert again.status == TransactionStatus.REVERSED
    assert await TransactionRepository(db_session).count_reversals_of(txn.id) == 1


async def test_failed_retry_and_internal_rules(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    txn = await service.create(
        TransactionCreate(
            event_id=seed["event"].id,
            cost_item_id=seed["internal_item"].id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("500.00"),
            transaction_date=date(2026, 7, 2),
        )
    )
    await service.transition_status(txn.id, TransactionStatus.FAILED)
    with pytest.raises(InvalidStateError):
        await service.transition_status(txn.id, TransactionStatus.COMPLETED)
    pending = await service.transition_status(txn.id, TransactionStatus.PENDING)
    assert pending.status == TransactionStatus.PENDING

    with pytest.raises(DomainValidationError):
        await service.create(
            TransactionCreate(
                event_id=seed["event"].id,
                cost_item_id=seed["internal_item"].id,
                work_order_id=seed["work_order"].id,
                transaction_type=TransactionType.INTERNAL_EXPENSE,
                payment_method=PaymentMethod.CASH,
                amount=Decimal("100.00"),
                transaction_date=date(2026, 7, 2),
            )
        )


async def test_cross_fk_and_closed_event(db_session: AsyncSession) -> None:
    seed = await _seed(db_session)
    service = TransactionService(db_session)
    other = await CostItemService(db_session).create(
        CostItemCreate(
            event_id=seed["event"].id,
            category_id=(
                await CostCategoryService(db_session).create(
                    CostCategoryCreate(event_id=seed["event"].id, name="Other")
                )
            ).id,
            title="Lighting",
            expense_type=ExpenseType.VENDOR,
            budget_amount=Decimal("1000.00"),
            vendor_required=True,
        )
    )
    with pytest.raises(DomainValidationError):
        await service.create(
            TransactionCreate(
                event_id=seed["event"].id,
                cost_item_id=other.id,
                work_order_id=seed["work_order"].id,
                transaction_type=TransactionType.VENDOR_PAYMENT,
                payment_method=PaymentMethod.CARD,
                amount=Decimal("100.00"),
                transaction_date=date(2026, 7, 3),
            )
        )

    events = EventService(db_session)
    await events.transition_status(seed["event"].id, EventStatus.PLANNING)
    await events.transition_status(seed["event"].id, EventStatus.COMMERCIALS)
    await events.transition_status(seed["event"].id, EventStatus.PROCUREMENT)
    await events.transition_status(seed["event"].id, EventStatus.EXECUTION)
    await events.transition_status(seed["event"].id, EventStatus.SETTLEMENT)
    await events.transition_status(seed["event"].id, EventStatus.CLOSED)
    with pytest.raises(InvalidStateError):
        await service.create(
            TransactionCreate(
                event_id=seed["event"].id,
                cost_item_id=seed["internal_item"].id,
                transaction_type=TransactionType.INTERNAL_EXPENSE,
                payment_method=PaymentMethod.CASH,
                amount=Decimal("10.00"),
                transaction_date=date(2026, 7, 3),
            )
        )

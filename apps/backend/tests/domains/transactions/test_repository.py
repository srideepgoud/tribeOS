"""TransactionRepository / CostAllocationRepository persistence tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
from app.domains.cost_allocations.models import CostAllocation
from app.domains.cost_allocations.repository import CostAllocationRepository
from app.domains.cost_categories.schemas import CostCategoryCreate
from app.domains.cost_categories.service import CostCategoryService
from app.domains.cost_items.models import ExpenseType
from app.domains.cost_items.schemas import CostItemCreate
from app.domains.cost_items.service import CostItemService
from app.domains.events.schemas import EventCreate
from app.domains.events.service import EventService
from app.domains.transactions.models import (
    PaymentMethod,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.domains.transactions.repository import TransactionRepository


async def test_sum_completed_allocations_only(db_session: AsyncSession) -> None:
    client = await ClientService(db_session).create(ClientCreate(company_name="Acme"))
    event = await EventService(db_session).create(EventCreate(client_id=client.id, name="Gala"))
    category = await CostCategoryService(db_session).create(
        CostCategoryCreate(event_id=event.id, name="Ops")
    )
    item = await CostItemService(db_session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Meals",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("1000.00"),
        )
    )
    txn_repo = TransactionRepository(db_session)
    alloc_repo = CostAllocationRepository(db_session)

    completed = Transaction(
        event_id=event.id,
        cost_item_id=item.id,
        transaction_type=TransactionType.INTERNAL_EXPENSE,
        payment_method=PaymentMethod.CASH,
        amount=Decimal("300.00"),
        transaction_date=date(2026, 7, 1),
        status=TransactionStatus.COMPLETED,
    )
    pending = Transaction(
        event_id=event.id,
        cost_item_id=item.id,
        transaction_type=TransactionType.INTERNAL_EXPENSE,
        payment_method=PaymentMethod.CASH,
        amount=Decimal("100.00"),
        transaction_date=date(2026, 7, 1),
        status=TransactionStatus.PENDING,
    )
    await txn_repo.add(completed)
    await txn_repo.add(pending)
    await alloc_repo.add(
        CostAllocation(
            transaction_id=completed.id,
            cost_item_id=item.id,
            allocated_amount=Decimal("300.00"),
        )
    )
    await alloc_repo.add(
        CostAllocation(
            transaction_id=pending.id,
            cost_item_id=item.id,
            allocated_amount=Decimal("100.00"),
        )
    )
    await db_session.commit()
    assert await alloc_repo.sum_completed_allocations_for_cost_item(item.id) == Decimal("300.00")

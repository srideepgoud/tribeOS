"""Cost Allocation repository tests."""

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
from app.domains.transactions.models import PaymentMethod, TransactionStatus, TransactionType
from app.domains.transactions.schemas import TransactionCreate
from app.domains.transactions.service import TransactionService


async def test_add_list_sum(db_session: AsyncSession) -> None:
    client = await ClientService(db_session).create(ClientCreate(company_name="Repo Co"))
    event = await EventService(db_session).create(EventCreate(client_id=client.id, name="Show"))
    category = await CostCategoryService(db_session).create(
        CostCategoryCreate(event_id=event.id, name="Ops")
    )
    item = await CostItemService(db_session).create(
        CostItemCreate(
            event_id=event.id,
            category_id=category.id,
            title="Fuel",
            expense_type=ExpenseType.INTERNAL,
            budget_amount=Decimal("1000.00"),
        )
    )
    txn = await TransactionService(db_session).create(
        TransactionCreate(
            event_id=event.id,
            cost_item_id=item.id,
            transaction_type=TransactionType.INTERNAL_EXPENSE,
            payment_method=PaymentMethod.CASH,
            amount=Decimal("200.00"),
            transaction_date=date(2026, 7, 1),
        )
    )
    repo = CostAllocationRepository(db_session)
    await repo.add(
        CostAllocation(
            transaction_id=txn.id,
            cost_item_id=item.id,
            allocated_amount=Decimal("150.00"),
        )
    )
    rows = await repo.list_by_transaction(txn.id)
    assert len(rows) == 1
    assert await repo.sum_for_transaction(txn.id) == Decimal("150.00")
    assert txn.status == TransactionStatus.PENDING

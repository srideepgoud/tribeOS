"""TransactionRepository tests."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.clients.schemas import ClientCreate
from app.domains.clients.service import ClientService
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


async def test_sum_completed_only(db_session: AsyncSession) -> None:
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
    repo = TransactionRepository(db_session)
    for status, amount, txn_type in (
        (TransactionStatus.PENDING, Decimal("100.00"), TransactionType.INTERNAL_EXPENSE),
        (TransactionStatus.FAILED, Decimal("200.00"), TransactionType.INTERNAL_EXPENSE),
        (TransactionStatus.COMPLETED, Decimal("300.00"), TransactionType.INTERNAL_EXPENSE),
        (TransactionStatus.COMPLETED, Decimal("-50.00"), TransactionType.REVERSAL),
        (TransactionStatus.REVERSED, Decimal("40.00"), TransactionType.INTERNAL_EXPENSE),
    ):
        await repo.add(
            Transaction(
                event_id=event.id,
                cost_item_id=item.id,
                transaction_type=txn_type,
                payment_method=PaymentMethod.CASH,
                amount=amount,
                transaction_date=date(2026, 7, 1),
                status=status,
            )
        )
    await db_session.commit()
    assert await repo.sum_completed_amounts_for_cost_item(item.id) == Decimal("300.00")

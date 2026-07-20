"""Transaction ORM model.

Columns follow ``docs/db_schema.md`` (§11 transactions), including
``reverses_transaction_id``. No soft-delete — ledger rows are never archived.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import AuditUserMixin, TimestampMixin, UUIDPrimaryKeyMixin


class TransactionType(enum.StrEnum):
    """Transaction classification (docs/db_schema.md)."""

    VENDOR_PAYMENT = "Vendor Payment"
    CLIENT_RECEIPT = "Client Receipt"
    INTERNAL_EXPENSE = "Internal Expense"
    REFUND = "Refund"
    ADJUSTMENT = "Adjustment"
    REVERSAL = "Reversal"


class PaymentMethod(enum.StrEnum):
    """Locked Finance Foundation payment methods."""

    BANK_TRANSFER = "Bank Transfer"
    CASH = "Cash"
    CHEQUE = "Cheque"
    UPI = "UPI"
    CARD = "Card"
    OTHER = "Other"


class TransactionStatus(enum.StrEnum):
    """Transaction lifecycle (docs/state_machine.md §5 + Phase 7 locks)."""

    PENDING = "Pending"
    COMPLETED = "Completed"
    FAILED = "Failed"
    REVERSED = "Reversed"


_TransactionTypeColumn = Enum(
    TransactionType,
    name="transaction_type",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)

_PaymentMethodColumn = Enum(
    PaymentMethod,
    name="payment_method",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)

_TransactionStatusColumn = Enum(
    TransactionStatus,
    name="transaction_status",
    native_enum=False,
    values_callable=lambda enum_cls: [member.value for member in enum_cls],
    length=32,
)


class Transaction(UUIDPrimaryKeyMixin, TimestampMixin, AuditUserMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_event_id_status", "event_id", "status"),)

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", name="fk_transactions_event_id_events"),
        nullable=False,
        index=True,
    )
    cost_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("cost_items.id", name="fk_transactions_cost_item_id_cost_items"),
        nullable=True,
        index=True,
    )
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "vendor_work_orders.id", name="fk_transactions_work_order_id_vendor_work_orders"
        ),
        nullable=True,
        index=True,
    )
    client_invoice_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey(
            "client_invoices.id", name="fk_transactions_client_invoice_id_client_invoices"
        ),
        nullable=True,
        index=True,
    )
    reverses_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("transactions.id", name="fk_transactions_reverses_transaction_id"),
        nullable=True,
        index=True,
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        _TransactionTypeColumn, nullable=False, index=True
    )
    payment_method: Mapped[PaymentMethod] = mapped_column(_PaymentMethodColumn, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(128), default=None)
    status: Mapped[TransactionStatus] = mapped_column(
        _TransactionStatusColumn,
        nullable=False,
        default=TransactionStatus.PENDING,
        index=True,
    )
    remarks: Mapped[str | None] = mapped_column(Text, default=None)

"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@tribeos/ui";

import { CostItemStatusBadge } from "@/features/cost-items/components/cost-item-status-badge";
import { TransactionFormDialog } from "@/features/transactions/components/txn-form-dialog";
import { TransactionStatusBadge } from "@/features/transactions/components/txn-status-badge";
import { VendorWorkOrderFormDialog } from "@/features/vendor-work-orders/components/vwo-form-dialog";
import { VendorWorkOrderStatusBadge } from "@/features/vendor-work-orders/components/vwo-status-badge";
import { formatMoney } from "@/lib/money";
import type { CostItem } from "@/types/cost-item";
import type { Transaction } from "@/types/transaction";
import type { VendorWorkOrder } from "@/types/vendor-work-order";
import { isEventReadOnly } from "@/types/event";
import type { EventStatus } from "@/types/event";

import { useBudgetLineDetail } from "../../hooks/use-budget-line-detail";
import type { LineAttributionState } from "../../lib/budget-utils";

interface BudgetLineDetailPanelProps {
  line: CostItem | null;
  eventId: string;
  eventStatus: EventStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ATTRIBUTION_VARIANT: Record<
  LineAttributionState,
  "default" | "secondary" | "success" | "warning" | "danger" | "info"
> = {
  "No spend": "secondary",
  Unattributed: "warning",
  "Partially Attributed": "warning",
  "Fully Attributed": "success",
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function BudgetLineDetailPanel({
  line,
  eventId,
  eventStatus,
  open,
  onOpenChange,
}: BudgetLineDetailPanelProps) {
  const { workOrders, expenses, vendorNames, totals, attribution, isLoading } = useBudgetLineDetail(
    line,
    eventId,
  );
  const [assignVendorOpen, setAssignVendorOpen] = useState(false);
  const [recordExpenseOpen, setRecordExpenseOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<VendorWorkOrder | null>(null);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);

  const eventReadOnly = isEventReadOnly(eventStatus);
  const canAssignVendor = !eventReadOnly && line?.expense_type === "Vendor";
  const canRecordExpense = !eventReadOnly;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {line ? (
            <>
              <SheetHeader className="pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{line.title}</SheetTitle>
                  <CostItemStatusBadge status={line.status} />
                </div>
                <SheetDescription>
                  Budget line control center for work orders, expenses, and attribution.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 flex flex-col gap-6">
                {isLoading || !totals || !attribution ? (
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-14" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <SummaryMetric
                      label="Budget (editable in grid)"
                      value={formatMoney(totals.planned.toFixed(2))}
                    />
                    <SummaryMetric
                      label="Committed (from work orders)"
                      value={formatMoney(totals.committed.toFixed(2))}
                    />
                    <SummaryMetric
                      label="Actual (from attributed spend)"
                      value={formatMoney(totals.actual.toFixed(2))}
                    />
                    <SummaryMetric
                      label="Variance (calculated)"
                      value={formatMoney((totals.planned - totals.actual).toFixed(2))}
                    />
                  </div>
                )}

                {workOrders.length === 0 && expenses.length === 0 ? (
                  <section className="rounded-md border border-primary/30 bg-primary/5 p-4">
                    <h3 className="text-sm font-semibold text-foreground">Next steps</h3>
                    <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-foreground-secondary">
                      <li>Assign a vendor and create a work order (builds Committed).</li>
                      <li>Record expenses against this line (builds cash spend).</li>
                      <li>Allocate transactions so Actual reflects attributed cost.</li>
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canAssignVendor ? (
                        <Button size="sm" onClick={() => setAssignVendorOpen(true)}>
                          <Plus />
                          1. Assign vendor
                        </Button>
                      ) : null}
                      {canRecordExpense ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRecordExpenseOpen(true)}
                        >
                          <Plus />
                          2. Record expense
                        </Button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Vendor Work Orders</h3>
                    {canAssignVendor ? (
                      <Button size="sm" variant="secondary" onClick={() => setAssignVendorOpen(true)}>
                        <Plus />
                        Assign vendor
                      </Button>
                    ) : null}
                  </div>
                  {workOrders.length === 0 ? (
                    <p className="text-sm text-muted">No work orders on this line yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {workOrders.map((order) => (
                        <li
                          key={order.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {vendorNames[order.vendor_id] ?? order.work_order_number}
                            </p>
                            <p className="text-xs text-muted">{order.work_order_number}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm tabular-nums text-foreground-secondary">
                              {formatMoney(order.agreed_amount)}
                            </span>
                            <VendorWorkOrderStatusBadge status={order.status} />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${order.work_order_number}`}
                              onClick={() => setEditingWorkOrder(order)}
                            >
                              <Pencil />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Expenses</h3>
                    {canRecordExpense ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRecordExpenseOpen(true)}
                      >
                        <Plus />
                        Record expense
                      </Button>
                    ) : null}
                  </div>
                  {expenses.length === 0 ? (
                    <p className="text-sm text-muted">No expenses recorded on this line yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {expenses.map((expense) => (
                        <li
                          key={expense.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {expense.remarks?.trim() || expense.transaction_type}
                            </p>
                            <p className="text-xs text-muted">
                              {expense.transaction_date} · {expense.payment_method}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm tabular-nums text-foreground-secondary">
                              {formatMoney(expense.amount)}
                            </span>
                            <TransactionStatusBadge status={expense.status} />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Open expense"
                              onClick={() => setEditingExpense(expense)}
                            >
                              <Pencil />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {attribution ? (
                  <section className="flex flex-col gap-2 rounded-md border border-border bg-background-secondary p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">Attribution</h3>
                      <Badge variant={ATTRIBUTION_VARIANT[attribution.state]}>
                        {attribution.state}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted">
                      Cash recorded: {formatMoney(attribution.cashRecorded.toFixed(2))} · Attributed
                      cost: {formatMoney(attribution.attributed.toFixed(2))}
                    </p>
                  </section>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <VendorWorkOrderFormDialog
        open={assignVendorOpen}
        onOpenChange={setAssignVendorOpen}
        defaultCostItemId={line?.id}
      />
      <VendorWorkOrderFormDialog
        open={editingWorkOrder !== null}
        onOpenChange={(next) => {
          if (!next) setEditingWorkOrder(null);
        }}
        workOrder={editingWorkOrder}
      />
      <TransactionFormDialog
        open={recordExpenseOpen}
        onOpenChange={setRecordExpenseOpen}
        defaultEventId={eventId}
        defaultCostItemId={line?.id}
        defaultTransactionType="Internal Expense"
      />
      <TransactionFormDialog
        open={editingExpense !== null}
        onOpenChange={(next) => {
          if (!next) setEditingExpense(null);
        }}
        transaction={editingExpense}
      />
    </>
  );
}

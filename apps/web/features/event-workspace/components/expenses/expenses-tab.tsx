"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@tribeos/ui";

import { TransactionFormDialog } from "@/features/transactions/components/txn-form-dialog";
import { formatMoney } from "@/lib/money";
import { apiErrorMessage } from "@/services/http";
import { isEventReadOnly } from "@/types/event";
import { PAYMENT_METHODS, TRANSACTION_STATUSES, type Transaction, type TransactionStatus } from "@/types/transaction";

import { useExpensesData } from "../../hooks/use-expenses-data";
import {
  EXPENSE_FACETS,
  expenseCards,
  filterExpenses,
  type ExpenseFacet,
} from "../../lib/expenses-utils";
import { WorkspaceErrorState } from "../workspace-error-state";
import { ExpensesTable } from "./expenses-table";

interface ExpensesTabProps {
  eventId: string;
}

export function ExpensesTab({ eventId }: ExpensesTabProps) {
  const { event, expenses, summary, itemTitles, isLoading, isError, error, refetch } =
    useExpensesData(eventId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [methodFilter, setMethodFilter] = useState<(typeof PAYMENT_METHODS)[number] | "all">("all");
  const [facetFilter, setFacetFilter] = useState<ExpenseFacet>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const filtered = useMemo(
    () =>
      filterExpenses(expenses, {
        search,
        status: statusFilter,
        paymentMethod: methodFilter,
        facet: facetFilter,
      }),
    [expenses, search, statusFilter, methodFilter, facetFilter],
  );

  const cards = expenseCards(summary);
  const hasFilters =
    search.trim().length > 0 || statusFilter !== "all" || methodFilter !== "all" || facetFilter !== "all";
  const canCreate = event ? !isEventReadOnly(event.status) : false;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load event expenses.")}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Expenses</h2>
          <p className="text-sm text-muted">
            Event-scoped expense ledger with allocation visibility and in-context editing.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Record expense
          </Button>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Cash spent" value={cards.cashSpent} />
        <MetricCard label="Attributed cost" value={cards.attributedCost} />
        <MetricCard label="Unattributed spend" value={cards.unattributedSpend} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(evt) => setSearch(evt.target.value)}
            placeholder="Search type, reference, remarks"
            aria-label="Search expenses"
            className="pl-9"
          />
        </div>
        <Select value={facetFilter} onValueChange={(v) => setFacetFilter(v as ExpenseFacet)}>
          <SelectTrigger className="w-[180px]" aria-label="Filter by kind">
            <SelectValue placeholder="Kind" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_FACETS.map((facet) => (
              <SelectItem key={facet} value={facet}>
                {facet === "all" ? "All kinds" : facet}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={methodFilter}
          onValueChange={(v) => setMethodFilter(v as (typeof PAYMENT_METHODS)[number] | "all")}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by payment method">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TransactionStatus | "all")}>
          <SelectTrigger className="w-[170px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TRANSACTION_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
          {hasFilters
            ? "No expenses match your filters."
            : "No expenses recorded yet for this event."}
        </div>
      ) : (
        <ExpensesTable expenses={filtered} costItemTitles={itemTitles} onOpen={setEditing} />
      )}

      <TransactionFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultEventId={eventId}
        defaultTransactionType="Internal Expense"
      />
      <TransactionFormDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        transaction={editing}
      />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatMoney(value)}</p>
    </div>
  );
}

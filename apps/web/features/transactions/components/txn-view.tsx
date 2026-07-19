"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import { useCostItems } from "@/features/cost-items/hooks";
import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { Transaction, TransactionStatus } from "@/types/transaction";
import { TRANSACTION_STATUSES } from "@/types/transaction";

import { useTransactions } from "../hooks";
import { TransactionsEmptyState } from "./txn-empty-state";
import { TransactionsErrorState } from "./txn-error-state";
import { TransactionFormDialog } from "./txn-form-dialog";
import { TransactionsLoading } from "./txn-loading";
import { TransactionTable } from "./txn-table";

const PAGE_SIZE = 20;

export function TransactionsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      q: search.trim() || undefined,
      sort: "-created_at",
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );
  const query = useTransactions(params);
  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const costItemsQuery = useCostItems({ page: 1, page_size: 100, sort: "title" });

  const eventNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of eventsQuery.data?.data ?? []) map[event.id] = event.name;
    return map;
  }, [eventsQuery.data?.data]);

  const costItemTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of costItemsQuery.data?.data ?? []) map[item.id] = item.title;
    return map;
  }, [costItemsQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const transactions = query.data?.data ?? [];
  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Transactions</h1>
          <p className="text-sm text-muted">Immutable financial ledger for Tribe events.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New transaction
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search reference or remarks"
            aria-label="Search transactions"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as TransactionStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
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

      {query.isLoading ? (
        <TransactionsLoading />
      ) : query.isError ? (
        <TransactionsErrorState
          message={apiErrorMessage(query.error, "Something went wrong while loading transactions.")}
          onRetry={() => void query.refetch()}
        />
      ) : transactions.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No transactions match your filters.
          </div>
        ) : (
          <TransactionsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <TransactionTable
            transactions={transactions}
            eventNames={eventNames}
            costItemTitles={costItemTitles}
            onEdit={setEditing}
          />
          {pagination && pagination.total_pages > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Page {pagination.page} of {pagination.total_pages} · {pagination.total_items} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <TransactionFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TransactionFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        transaction={editing}
      />
    </div>
  );
}

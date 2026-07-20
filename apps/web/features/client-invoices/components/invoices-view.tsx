"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { ClientInvoice, ClientInvoiceStatus } from "@/types/client-invoice";
import { CLIENT_INVOICE_STATUSES } from "@/types/client-invoice";

import { useClientInvoices } from "../hooks";
import { ClientInvoiceDetailDialog } from "./invoice-detail-dialog";
import { ClientInvoiceFormDialog } from "./invoice-form-dialog";
import {
  ClientInvoicesEmptyState,
  ClientInvoicesErrorState,
  ClientInvoicesLoading,
} from "./invoice-states";
import { ClientInvoiceTable } from "./invoice-table";

const PAGE_SIZE = 20;

export function ClientInvoicesView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientInvoiceStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientInvoice | null>(null);
  const [detail, setDetail] = useState<ClientInvoice | null>(null);

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
  const query = useClientInvoices(params);
  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });

  const eventNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of eventsQuery.data?.data ?? []) map[event.id] = event.name;
    return map;
  }, [eventsQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const invoices = query.data?.data ?? [];
  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Client Invoices</h1>
          <p className="text-sm text-muted">
            What the client owes. Cash received is recorded as Client Receipt Transactions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New invoice
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
            placeholder="Search invoices"
            aria-label="Search invoices"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as ClientInvoiceStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CLIENT_INVOICE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? <ClientInvoicesLoading /> : null}
      {query.isError ? (
        <ClientInvoicesErrorState message={apiErrorMessage(query.error)} />
      ) : null}
      {!query.isLoading && !query.isError && invoices.length === 0 ? (
        <ClientInvoicesEmptyState onCreate={() => setCreateOpen(true)} hasFilters={hasFilters} />
      ) : null}
      {!query.isLoading && !query.isError && invoices.length > 0 ? (
        <>
          <ClientInvoiceTable
            invoices={invoices}
            eventNames={eventNames}
            onOpen={(row) => setDetail(row)}
          />
          {pagination && pagination.total_pages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : null}

      <ClientInvoiceFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        invoice={editing}
      />
      <ClientInvoiceDetailDialog
        open={Boolean(detail)}
        onOpenChange={(next) => {
          if (!next) setDetail(null);
        }}
        invoice={detail}
        onEdit={(row) => {
          setDetail(null);
          setEditing(row);
        }}
        onInvoiceChange={setDetail}
      />
    </div>
  );
}

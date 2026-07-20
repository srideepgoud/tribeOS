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

import {
  ClientInvoicesEmptyState,
  ClientInvoicesErrorState,
} from "@/features/client-invoices/components/invoice-states";
import { ClientInvoiceDetailDialog } from "@/features/client-invoices/components/invoice-detail-dialog";
import { ClientInvoiceFormDialog } from "@/features/client-invoices/components/invoice-form-dialog";
import { ClientInvoiceTable } from "@/features/client-invoices/components/invoice-table";
import { apiErrorMessage } from "@/services/http";
import type { ClientInvoice, ClientInvoiceStatus } from "@/types/client-invoice";
import { CLIENT_INVOICE_STATUSES } from "@/types/client-invoice";
import { isEventReadOnly } from "@/types/event";
import { formatMoney } from "@/lib/money";

import { WORKSPACE_TABS, isTabAvailable } from "../../constants";
import { useInvoicesData } from "../../hooks/use-invoices-data";
import { filterInvoices, invoiceCollectionSummary } from "../../lib/invoices-utils";
import { TabGatePanel } from "../tab-gate-panel";

interface InvoicesTabProps {
  eventId: string;
}

export function InvoicesTab({ eventId }: InvoicesTabProps) {
  const { event, invoices, isLoading, isError, error } = useInvoicesData(eventId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientInvoiceStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientInvoice | null>(null);
  const [detail, setDetail] = useState<ClientInvoice | null>(null);

  const filtered = useMemo(
    () => filterInvoices(invoices, { query: search, status: statusFilter }),
    [invoices, search, statusFilter],
  );
  const summary = useMemo(() => invoiceCollectionSummary(invoices), [invoices]);
  const canCreate = event ? !isEventReadOnly(event.status) : false;
  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

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
      <ClientInvoicesErrorState
        message={apiErrorMessage(error, "Could not load event invoices.")}
      />
    );
  }

  const invoicesTab = WORKSPACE_TABS.find((tab) => tab.id === "invoices")!;
  if (!isTabAvailable(event.status, invoicesTab)) {
    return <TabGatePanel event={event} tab={invoicesTab} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Invoices</h2>
          <p className="text-sm text-muted">
            Event-scoped client invoices. Payment statuses are derived from Client Receipts.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            New invoice
          </Button>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Billed total" value={summary.total} />
        <MetricCard label="Collected (derived)" value={summary.collected} />
        <MetricCard label="Outstanding" value={summary.outstanding} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(evt) => setSearch(evt.target.value)}
            placeholder="Search invoices"
            aria-label="Search invoices"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as ClientInvoiceStatus | "all")}
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

      {filtered.length === 0 ? (
        <ClientInvoicesEmptyState onCreate={() => setCreateOpen(true)} hasFilters={hasFilters} />
      ) : (
        <ClientInvoiceTable
          invoices={filtered}
          eventNames={{ [event.id]: event.name }}
          onOpen={(row) => setDetail(row)}
        />
      )}

      <ClientInvoiceFormDialog
        open={createOpen || Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) {
            setCreateOpen(false);
            setEditing(null);
          }
        }}
        invoice={editing}
        defaultEventId={event.id}
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {formatMoney(value.toFixed(2))}
      </p>
    </div>
  );
}

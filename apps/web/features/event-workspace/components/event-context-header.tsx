"use client";

import { Skeleton } from "@tribeos/ui";

import { EventStatusBadge } from "@/features/events/components/event-status-badge";
import { formatMoney } from "@/lib/money";
import type { Event } from "@/types/event";
import type { EventFinancialSummary } from "@/types/cost-allocation";

interface EventContextHeaderProps {
  event: Event;
  clientName: string | undefined;
  summary: EventFinancialSummary | undefined;
  summaryLoading: boolean;
  plannedBudget: string;
}

function formatDateRange(start: string | null, end: string | null): string {
  const format = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;
  const startLabel = format(start);
  const endLabel = format(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel ?? "Dates TBD";
}

function KpiChip({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="min-w-[7rem] rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-5 w-20" />
      ) : (
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      )}
    </div>
  );
}

export function EventContextHeader({
  event,
  clientName,
  summary,
  summaryLoading,
  plannedBudget,
}: EventContextHeaderProps) {
  const profit =
    summary !== undefined
      ? (Number(summary.billed_revenue) - Number(summary.attributed_cost)).toFixed(2)
      : "0.00";

  return (
    <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 lg:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground lg:text-2xl">{event.name}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="text-sm text-muted">
            {[clientName, formatDateRange(event.start_datetime, event.end_datetime)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0">
        <KpiChip
          label="Budget"
          value={formatMoney(plannedBudget)}
          loading={summaryLoading}
        />
        <KpiChip
          label="Cash Spent"
          value={formatMoney(summary?.cash_spent ?? "0")}
          loading={summaryLoading}
        />
        <KpiChip
          label="Unattributed"
          value={formatMoney(summary?.unattributed_spend ?? "0")}
          loading={summaryLoading}
        />
        <KpiChip
          label="Outstanding"
          value={formatMoney(summary?.outstanding ?? "0")}
          loading={summaryLoading}
        />
        <KpiChip label="Profit (derived)" value={formatMoney(profit)} loading={summaryLoading} />
      </div>
    </header>
  );
}

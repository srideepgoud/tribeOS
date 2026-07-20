"use client";

import { apiErrorMessage } from "@/services/http";
import type { OperationsDashboard } from "@/types/dashboard";

import { useOperationsDashboard } from "../hooks";
import { AttentionSection } from "./attention-section";
import { DashboardErrorState } from "./dashboard-error-state";
import { DashboardEventTable } from "./dashboard-event-table";
import { DashboardLoading } from "./dashboard-loading";
import { FinanceCard } from "./finance-cards";
import { OverviewCard } from "./overview-cards";

export function DashboardView() {
  const query = useOperationsDashboard();

  if (query.isLoading) {
    return <DashboardLoading />;
  }

  if (query.isError || !query.data) {
    return (
      <DashboardErrorState
        message={apiErrorMessage(query.error, "Unable to load the operations dashboard.")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  return <DashboardContent data={query.data} />;
}

function DashboardContent({ data }: { data: OperationsDashboard }) {
  const { overview, finance, attention, events } = data;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Operations</h1>
        <p className="text-sm text-muted">
          Daily workload, financial position, and events ready for Financial Close.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard label="Active Events" value={overview.active_events} />
        <OverviewCard label="Settlement" value={overview.settlement_events} />
        <OverviewCard label="Closed" value={overview.closed_events} />
        <OverviewCard label="Ready To Close" value={overview.ready_to_close} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FinanceCard label="Billed Revenue" value={finance.billed_revenue} />
        <FinanceCard label="Cash Received" value={finance.cash_received} />
        <FinanceCard label="Outstanding" value={finance.outstanding} />
        <FinanceCard label="Cash Spent" value={finance.cash_spent} />
        <FinanceCard label="Attributed Cost" value={finance.attributed_cost} />
        <FinanceCard label="Gross Profit" value={finance.gross_profit} />
      </section>

      <AttentionSection attention={attention} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Events</h2>
          <p className="text-sm text-muted">Active and Settlement events with financial readiness.</p>
        </div>
        <DashboardEventTable events={events} />
      </section>
    </div>
  );
}

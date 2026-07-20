import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { DashboardErrorState } from "@/features/dashboard/components/dashboard-error-state";
import { DashboardEventTable } from "@/features/dashboard/components/dashboard-event-table";
import { DashboardLoading } from "@/features/dashboard/components/dashboard-loading";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import type { OperationsDashboard } from "@/types/dashboard";

const sampleDashboard: OperationsDashboard = {
  overview: {
    active_events: 2,
    settlement_events: 1,
    closed_events: 3,
    ready_to_close: 1,
  },
  finance: {
    billed_revenue: "10000.00",
    cash_received: "4000.00",
    outstanding: "6000.00",
    cash_spent: "2500.00",
    attributed_cost: "2500.00",
    gross_profit: "7500.00",
  },
  attention: {
    outstanding_events: 1,
    pending_transactions: 0,
    unattributed_events: 0,
    ready_to_close_events: 1,
  },
  events: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Annual Gala",
      status: "Settlement",
      client_name: "Acme Events",
      billed_revenue: "10000.00",
      cash_received: "4000.00",
      outstanding: "6000.00",
      attributed_cost: "2500.00",
      gross_profit: "7500.00",
      financial_ready: false,
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Ready Fest",
      status: "Settlement",
      client_name: "Acme Events",
      billed_revenue: "0.00",
      cash_received: "0.00",
      outstanding: "0.00",
      attributed_cost: "0.00",
      gross_profit: "0.00",
      financial_ready: true,
    },
  ],
};

const getOperations = vi.fn();

vi.mock("@/services/dashboard", () => ({
  dashboardService: {
    getOperations: (...args: unknown[]) => getOperations(...args),
  },
}));

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("dashboard feature", () => {
  beforeEach(() => {
    getOperations.mockReset();
  });

  it("renders loading state", () => {
    render(<DashboardLoading />);
    expect(screen.getByLabelText(/loading dashboard/i)).toBeInTheDocument();
  });

  it("renders attention cards", () => {
    render(<AttentionSection attention={sampleDashboard.attention} />);
    expect(screen.getByText("Action Required")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Receivables")).toBeInTheDocument();
    expect(screen.getByText("Pending Transactions")).toBeInTheDocument();
    expect(screen.getByText("Unattributed Spend")).toBeInTheDocument();
    expect(screen.getByText("Ready To Close")).toBeInTheDocument();
  });

  it("renders event table with readiness and navigation", () => {
    render(<DashboardEventTable events={sampleDashboard.events} />);
    expect(screen.getByText("Annual Gala")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Events").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Attention Required")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Ready to Close")).toBeInTheDocument();
    expect(screen.getAllByText("Outstanding").length).toBeGreaterThanOrEqual(1);
    const link = screen.getByRole("link", { name: "Annual Gala" });
    expect(link).toHaveAttribute("href", "/events");
  });

  it("renders empty state when there are no events", () => {
    render(<DashboardEventTable events={[]} />);
    expect(screen.getByText(/no active or settlement events/i)).toBeInTheDocument();
  });

  it("error state retries", () => {
    const onRetry = vi.fn();
    render(<DashboardErrorState message="Boom" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("dashboard view renders cards and table from API data", async () => {
    getOperations.mockResolvedValue(sampleDashboard);
    renderWithClient(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText("Operations")).toBeInTheDocument();
    });
    expect(screen.getByText("Active Events")).toBeInTheDocument();
    expect(screen.getByText("Billed Revenue")).toBeInTheDocument();
    expect(screen.getByText("Gross Profit")).toBeInTheDocument();
    expect(screen.getByText("Annual Gala")).toBeInTheDocument();
    expect(getOperations).toHaveBeenCalledOnce();
  });
});

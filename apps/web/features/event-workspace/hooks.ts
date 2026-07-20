"use client";

import { useMemo } from "react";

import { useClients } from "@/features/clients/hooks";
import { useCostCategories } from "@/features/cost-categories/hooks";
import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent, useEventFinancialReadiness } from "@/features/events/hooks";
import { useTransactions, useEventFinancialSummary } from "@/features/transactions/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { statusRank } from "@/features/event-workspace/constants";
import type { EventStatus } from "@/types/event";

export type ReadinessStatus = "done" | "attention" | "blocked" | "not_started";

export interface ReadinessIndicator {
  readonly id: string;
  readonly label: string;
  readonly status: ReadinessStatus;
  readonly detail: string;
  readonly href: string;
}

export interface NextAction {
  readonly label: string;
  readonly description: string;
  readonly href: string;
}

export interface EventOverviewData {
  readonly indicators: readonly ReadinessIndicator[];
  readonly nextAction: NextAction;
  readonly profitForecast: string | null;
}

function commercialComplete(status: EventStatus): boolean {
  return statusRank(status) >= statusRank("Procurement");
}

export function useEventOverview(eventId: string) {
  const eventQuery = useEvent(eventId);
  const summaryQuery = useEventFinancialSummary(eventId);
  const readinessQuery = useEventFinancialReadiness(
    eventId,
    eventQuery.data?.status === "Settlement" || eventQuery.data?.status === "Closed",
  );
  const categoriesQuery = useCostCategories({ page: 1, page_size: 100, event_id: eventId });
  const costItemsQuery = useCostItems({ page: 1, page_size: 100, event_id: eventId });
  const workOrdersQuery = useVendorWorkOrders({ page: 1, page_size: 100 });
  const pendingTxnQuery = useTransactions({
    page: 1,
    page_size: 1,
    event_id: eventId,
    status: "Pending",
  });
  const clientsQuery = useClients({ page: 1, page_size: 100, sort: "company_name" });

  const clientName = useMemo(() => {
    const clientId = eventQuery.data?.client_id;
    if (!clientId) return undefined;
    return clientsQuery.data?.data.find((client) => client.id === clientId)?.company_name;
  }, [clientsQuery.data?.data, eventQuery.data?.client_id]);

  const overview = useMemo((): EventOverviewData | undefined => {
    const event = eventQuery.data;
    const summary = summaryQuery.data;
    if (!event) return undefined;

    const categories = categoriesQuery.data?.data ?? [];
    const costItems = (costItemsQuery.data?.data ?? []).filter((item) => !item.archived_at);
    const workOrders = workOrdersQuery.data?.data ?? [];
    const costItemIds = new Set(costItems.map((item) => item.id));
    const linesWithWorkOrders = new Set(
      workOrders
        .filter((order) => costItemIds.has(order.cost_item_id))
        .map((order) => order.cost_item_id),
    );
    const uncoveredCount = costItems.length - linesWithWorkOrders.size;
    const hasBudgetLines = costItems.length > 0;
    const hasSections = categories.length > 0;
    const budgetComplete = hasSections && hasBudgetLines;
    const outstanding = Number(summary?.outstanding ?? 0);
    const unattributed = Number(summary?.unattributed_spend ?? 0);
    const pendingCount = pendingTxnQuery.data?.meta.pagination.total_items ?? 0;
    const readiness = readinessQuery.data;

    const indicators: ReadinessIndicator[] = [
      {
        id: "budget",
        label: "Budget Complete",
        status: budgetComplete ? "done" : hasSections || hasBudgetLines ? "attention" : "not_started",
        detail: budgetComplete
          ? `${costItems.length} lines across ${categories.length} sections`
          : "Add budget sections and lines",
        href: `/events/${eventId}/budget`,
      },
      {
        id: "commercial",
        label: "Commercial Complete",
        status: commercialComplete(event.status) ? "done" : "attention",
        detail: commercialComplete(event.status)
          ? `Event is in ${event.status}`
          : "Advance to Procurement when the commercial plan is ready",
        href: `/events/${eventId}/budget`,
      },
      {
        id: "vendor-coverage",
        label: "Vendor Coverage",
        status:
          costItems.length === 0
            ? "not_started"
            : uncoveredCount === 0
              ? "done"
              : "attention",
        detail:
          costItems.length === 0
            ? "Build the budget first"
            : `${linesWithWorkOrders.size} of ${costItems.length} lines have a work order`,
        href: `/events/${eventId}/execution`,
      },
      {
        id: "pending-payments",
        label: "Pending Payments",
        status: pendingCount === 0 ? "done" : "attention",
        detail:
          pendingCount === 0
            ? "No pending financial transactions"
            : `${pendingCount} pending transaction${pendingCount === 1 ? "" : "s"}`,
        href: `/events/${eventId}/expenses`,
      },
      {
        id: "pending-collections",
        label: "Pending Collections",
        status: outstanding <= 0 ? "done" : "attention",
        detail:
          outstanding <= 0 ? "Event outstanding cleared" : `₹${outstanding.toLocaleString("en-IN")} outstanding`,
        href: `/events/${eventId}/invoices`,
      },
      {
        id: "settlement",
        label: "Settlement Readiness",
        status:
          event.status === "Closed"
            ? "done"
            : readiness?.ready
              ? "done"
              : event.status === "Settlement"
                ? "blocked"
                : "not_started",
        detail:
          event.status === "Closed"
            ? "Event closed"
            : readiness?.ready
              ? "Ready to close"
              : event.status === "Settlement"
                ? "Resolve close gates in Settlement"
                : "Available in Settlement phase",
        href: `/events/${eventId}/settlement`,
      },
      {
        id: "profit",
        label: "Profit Forecast",
        status: summary ? "done" : "not_started",
        detail: summary
          ? "Derived: Billed Revenue − Attributed Cost"
          : "Financial summary loading",
        href: `/events/${eventId}/settlement`,
      },
    ];

    let nextAction: NextAction;
    if (!budgetComplete) {
      nextAction = {
        label: "Build your budget",
        description: "Add budget sections and lines for this event.",
        href: `/events/${eventId}/budget`,
      };
    } else if (!commercialComplete(event.status) && event.status !== "Cancelled") {
      nextAction = {
        label: "Complete commercial planning",
        description: "Review the budget and advance the event to Procurement.",
        href: `/events/${eventId}/budget`,
      };
    } else if (uncoveredCount > 0 && statusRank(event.status) >= statusRank("Procurement")) {
      nextAction = {
        label: `Assign vendors to ${uncoveredCount} uncovered line${uncoveredCount === 1 ? "" : "s"}`,
        description: "Work orders commit budget lines to vendors.",
        href: `/events/${eventId}/execution`,
      };
    } else if (unattributed > 0) {
      nextAction = {
        label: "Allocate unattributed spend",
        description: "Completed cash must be attributed to budget lines.",
        href: `/events/${eventId}/expenses`,
      };
    } else if (outstanding > 0) {
      nextAction = {
        label: "Collect outstanding receivables",
        description: "Client invoices remain unpaid for this event.",
        href: `/events/${eventId}/invoices`,
      };
    } else if (pendingCount > 0) {
      nextAction = {
        label: "Resolve pending transactions",
        description: "Financial transactions need to be completed or failed.",
        href: `/events/${eventId}/expenses`,
      };
    } else if (event.status === "Settlement" && readiness && !readiness.ready) {
      nextAction = {
        label: "Complete settlement checks",
        description: "Resolve the close gates before closing the event.",
        href: `/events/${eventId}/settlement`,
      };
    } else if (event.status === "Settlement" && readiness?.ready) {
      nextAction = {
        label: "Close this event",
        description: "All settlement checks pass. You can close the event.",
        href: `/events/${eventId}/settlement`,
      };
    } else {
      nextAction = {
        label: "Review event overview",
        description: "No immediate actions required.",
        href: `/events/${eventId}/overview`,
      };
    }

    const profitForecast =
      summary !== undefined
        ? (Number(summary.billed_revenue) - Number(summary.attributed_cost)).toFixed(2)
        : null;

    return { indicators, nextAction, profitForecast };
  }, [
    categoriesQuery.data?.data,
    costItemsQuery.data?.data,
    eventId,
    eventQuery.data,
    pendingTxnQuery.data?.meta.pagination.total_items,
    readinessQuery.data,
    summaryQuery.data,
    workOrdersQuery.data?.data,
  ]);

  const isLoading =
    eventQuery.isLoading ||
    summaryQuery.isLoading ||
    categoriesQuery.isLoading ||
    costItemsQuery.isLoading;

  const isError = eventQuery.isError;

  return {
    event: eventQuery.data,
    clientName,
    summary: summaryQuery.data,
    overview,
    isLoading,
    isError,
    error: eventQuery.error,
    refetch: () => void eventQuery.refetch(),
  };
}

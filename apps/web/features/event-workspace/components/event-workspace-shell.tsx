"use client";

import type { ReactNode } from "react";

import { useClients } from "@/features/clients/hooks";
import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent } from "@/features/events/hooks";
import { useEventFinancialSummary } from "@/features/transactions/hooks";
import { API_MAX_PAGE_SIZE } from "@/lib/api-pagination";
import { apiErrorMessage } from "@/services/http";

import { tabFromSegment, type WorkspaceTab } from "../constants";
import { EventContextHeader } from "./event-context-header";
import { EventWorkspaceTabs } from "./event-workspace-tabs";
import { WorkspaceBreadcrumb } from "./workspace-breadcrumb";
import { WorkspaceErrorState } from "./workspace-error-state";
import { WorkspaceLoading } from "./workspace-loading";

interface EventWorkspaceShellProps {
  eventId: string;
  activeTab: WorkspaceTab;
  children: ReactNode;
}

export function EventWorkspaceShell({ eventId, activeTab, children }: EventWorkspaceShellProps) {
  const eventQuery = useEvent(eventId);
  const summaryQuery = useEventFinancialSummary(eventId);
  const costItemsQuery = useCostItems({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    event_id: eventId,
  });
  const clientsQuery = useClients({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    sort: "company_name",
  });

  const clientName =
    clientsQuery.data?.data.find((client) => client.id === eventQuery.data?.client_id)
      ?.company_name;

  const plannedBudget = (costItemsQuery.data?.data ?? [])
    .filter((item) => !item.archived_at)
    .reduce((sum, item) => sum + Number(item.budget_amount), 0)
    .toFixed(2);

  if (eventQuery.isLoading) {
    return <WorkspaceLoading />;
  }

  if (eventQuery.isError || !eventQuery.data) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(eventQuery.error, "Could not load this event.")}
        onRetry={() => void eventQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WorkspaceBreadcrumb
        eventName={eventQuery.data.name}
        eventId={eventId}
        activeTab={activeTab}
      />
      <EventContextHeader
        event={eventQuery.data}
        clientName={clientName}
        summary={summaryQuery.data}
        summaryLoading={summaryQuery.isLoading}
        plannedBudget={plannedBudget}
      />
      <EventWorkspaceTabs eventId={eventId} eventStatus={eventQuery.data.status} />
      <div>{children}</div>
    </div>
  );
}

export function resolveActiveTab(segment: string): WorkspaceTab {
  return tabFromSegment(segment) ?? tabFromSegment("overview")!;
}

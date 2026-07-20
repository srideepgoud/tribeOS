"use client";

import { useMemo } from "react";

import { useCostCategories } from "@/features/cost-categories/hooks";
import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent } from "@/features/events/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { API_MAX_PAGE_SIZE } from "@/lib/api-pagination";

import {
  buildCommittedByLineId,
  computeBudgetTotals,
  groupBudgetSections,
  isBudgetEditable,
} from "../lib/budget-utils";

export function useBudgetData(eventId: string) {
  const eventQuery = useEvent(eventId);
  const categoriesQuery = useCostCategories({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    event_id: eventId,
    sort: "display_order",
  });
  const itemsQuery = useCostItems({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    event_id: eventId,
    sort: "title",
  });
  const workOrdersQuery = useVendorWorkOrders({ page: 1, page_size: API_MAX_PAGE_SIZE });

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];
  const workOrders = workOrdersQuery.data?.data ?? [];

  const committedByLineId = useMemo(() => buildCommittedByLineId(workOrders), [workOrders]);

  const sections = useMemo(
    () => groupBudgetSections(categories, items, committedByLineId),
    [categories, items, committedByLineId],
  );

  const eventTotals = useMemo(
    () =>
      computeBudgetTotals(
        items.filter((item) => !item.archived_at),
        committedByLineId,
      ),
    [items, committedByLineId],
  );

  const editable = eventQuery.data ? isBudgetEditable(eventQuery.data.status) : false;

  const isLoading = eventQuery.isLoading || categoriesQuery.isLoading || itemsQuery.isLoading;
  const isError = eventQuery.isError || categoriesQuery.isError || itemsQuery.isError;
  const error = eventQuery.error ?? categoriesQuery.error ?? itemsQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void categoriesQuery.refetch();
    void itemsQuery.refetch();
    void workOrdersQuery.refetch();
  };

  return {
    event: eventQuery.data,
    sections,
    categories,
    items,
    committedByLineId,
    eventTotals,
    editable,
    isLoading,
    isError,
    error,
    refetch,
  };
}

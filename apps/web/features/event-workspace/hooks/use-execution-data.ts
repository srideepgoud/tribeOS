"use client";

import { useMemo } from "react";

import { useCostCategories } from "@/features/cost-categories/hooks";
import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent } from "@/features/events/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { useVendors } from "@/features/vendors/hooks";

import { groupExecutionBySection } from "../lib/execution-utils";

export function useExecutionData(eventId: string) {
  const eventQuery = useEvent(eventId);
  const categoriesQuery = useCostCategories({
    page: 1,
    page_size: 100,
    event_id: eventId,
    sort: "display_order",
  });
  const itemsQuery = useCostItems({
    page: 1,
    page_size: 200,
    event_id: eventId,
    sort: "title",
  });
  const workOrdersQuery = useVendorWorkOrders({ page: 1, page_size: 200 });
  const vendorsQuery = useVendors({ page: 1, page_size: 100, sort: "company_name" });

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];
  const allWorkOrders = workOrdersQuery.data?.data ?? [];

  const eventItemIds = useMemo(
    () => new Set(items.filter((item) => !item.archived_at).map((item) => item.id)),
    [items],
  );

  const workOrders = useMemo(
    () => allWorkOrders.filter((order) => eventItemIds.has(order.cost_item_id)),
    [allWorkOrders, eventItemIds],
  );

  const groups = useMemo(
    () => groupExecutionBySection(categories, items, workOrders),
    [categories, items, workOrders],
  );

  const vendorNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vendor of vendorsQuery.data?.data ?? []) {
      map[vendor.id] = vendor.company_name;
    }
    return map;
  }, [vendorsQuery.data?.data]);

  const isLoading =
    eventQuery.isLoading ||
    categoriesQuery.isLoading ||
    itemsQuery.isLoading ||
    workOrdersQuery.isLoading ||
    vendorsQuery.isLoading;

  const isError =
    eventQuery.isError ||
    categoriesQuery.isError ||
    itemsQuery.isError ||
    workOrdersQuery.isError;

  const error =
    eventQuery.error ?? categoriesQuery.error ?? itemsQuery.error ?? workOrdersQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void categoriesQuery.refetch();
    void itemsQuery.refetch();
    void workOrdersQuery.refetch();
    void vendorsQuery.refetch();
  };

  return {
    event: eventQuery.data,
    groups,
    vendorNames,
    isLoading,
    isError,
    error,
    refetch,
  };
}

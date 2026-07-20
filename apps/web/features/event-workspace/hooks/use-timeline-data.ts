"use client";

import { useMemo } from "react";

import { useClientInvoices } from "@/features/client-invoices/hooks";
import { useCostCategories } from "@/features/cost-categories/hooks";
import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent } from "@/features/events/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { useVendors } from "@/features/vendors/hooks";
import { API_MAX_PAGE_SIZE } from "@/lib/api-pagination";

import { buildTimelineEntries } from "../lib/timeline-utils";

export function useTimelineData(eventId: string) {
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
  const transactionsQuery = useTransactions({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    event_id: eventId,
    sort: "-created_at",
  });
  const invoicesQuery = useClientInvoices({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    event_id: eventId,
    sort: "-created_at",
  });
  const vendorsQuery = useVendors({ page: 1, page_size: API_MAX_PAGE_SIZE, sort: "company_name" });

  const items = itemsQuery.data?.data ?? [];
  const eventItemIds = useMemo(
    () => new Set(items.filter((item) => !item.archived_at).map((item) => item.id)),
    [items],
  );

  const workOrders = useMemo(
    () => (workOrdersQuery.data?.data ?? []).filter((order) => eventItemIds.has(order.cost_item_id)),
    [workOrdersQuery.data?.data, eventItemIds],
  );

  const itemTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of items) {
      if (!item.archived_at) map[item.id] = item.title;
    }
    return map;
  }, [items]);

  const vendorNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vendor of vendorsQuery.data?.data ?? []) {
      map[vendor.id] = vendor.company_name;
    }
    return map;
  }, [vendorsQuery.data?.data]);

  const entries = useMemo(() => {
    const event = eventQuery.data;
    if (!event) return [];
    return buildTimelineEntries({
      eventId,
      event,
      categories: categoriesQuery.data?.data ?? [],
      costItems: items,
      workOrders,
      transactions: transactionsQuery.data?.data ?? [],
      invoices: invoicesQuery.data?.data ?? [],
      itemTitles,
      vendorNames,
    });
  }, [
    categoriesQuery.data?.data,
    eventId,
    eventQuery.data,
    invoicesQuery.data?.data,
    itemTitles,
    items,
    transactionsQuery.data?.data,
    vendorNames,
    workOrders,
  ]);

  const isLoading =
    eventQuery.isLoading ||
    categoriesQuery.isLoading ||
    itemsQuery.isLoading ||
    workOrdersQuery.isLoading ||
    transactionsQuery.isLoading ||
    invoicesQuery.isLoading;

  const isError =
    eventQuery.isError ||
    categoriesQuery.isError ||
    itemsQuery.isError ||
    transactionsQuery.isError ||
    invoicesQuery.isError;

  const error =
    eventQuery.error ??
    categoriesQuery.error ??
    itemsQuery.error ??
    transactionsQuery.error ??
    invoicesQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void categoriesQuery.refetch();
    void itemsQuery.refetch();
    void workOrdersQuery.refetch();
    void transactionsQuery.refetch();
    void invoicesQuery.refetch();
    void vendorsQuery.refetch();
  };

  return {
    event: eventQuery.data,
    entries,
    isLoading,
    isError,
    error,
    refetch,
  };
}

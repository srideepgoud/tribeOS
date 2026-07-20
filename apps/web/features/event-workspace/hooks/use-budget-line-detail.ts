"use client";

import { useMemo } from "react";

import { useTransactions } from "@/features/transactions/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { useVendors } from "@/features/vendors/hooks";
import { API_MAX_PAGE_SIZE } from "@/lib/api-pagination";
import type { CostItem } from "@/types/cost-item";

import {
  buildCommittedByLineId,
  computeLineAttribution,
  computeLineTotals,
} from "../lib/budget-utils";

const EXPENSE_TYPES = new Set(["Vendor Payment", "Internal Expense"]);

export function useBudgetLineDetail(line: CostItem | null, eventId: string) {
  const enabled = Boolean(line?.id);
  const workOrdersQuery = useVendorWorkOrders(
    {
      page: 1,
      page_size: API_MAX_PAGE_SIZE,
      cost_item_id: line?.id,
      sort: "-created_at",
    },
    enabled,
  );
  const transactionsQuery = useTransactions(
    {
      page: 1,
      page_size: API_MAX_PAGE_SIZE,
      event_id: eventId,
      cost_item_id: line?.id,
      sort: "-transaction_date",
    },
    enabled,
  );
  const vendorsQuery = useVendors({
    page: 1,
    page_size: API_MAX_PAGE_SIZE,
    sort: "company_name",
  });

  const workOrders = workOrdersQuery.data?.data ?? [];
  const transactions = transactionsQuery.data?.data ?? [];
  const vendorNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vendor of vendorsQuery.data?.data ?? []) {
      map[vendor.id] = vendor.company_name;
    }
    return map;
  }, [vendorsQuery.data?.data]);

  const committedByLineId = useMemo(() => buildCommittedByLineId(workOrders), [workOrders]);

  const totals = line ? computeLineTotals(line, committedByLineId) : null;
  const attribution = line ? computeLineAttribution(line, transactions) : null;
  const expenses = useMemo(
    () => transactions.filter((txn) => EXPENSE_TYPES.has(txn.transaction_type)),
    [transactions],
  );

  const isLoading =
    Boolean(line) &&
    (workOrdersQuery.isLoading || transactionsQuery.isLoading || vendorsQuery.isLoading);

  return {
    workOrders,
    expenses,
    vendorNames,
    totals,
    attribution,
    isLoading,
    refetch: () => {
      void workOrdersQuery.refetch();
      void transactionsQuery.refetch();
      void vendorsQuery.refetch();
    },
  };
}

"use client";

import { useMemo } from "react";

import { useCostItems } from "@/features/cost-items/hooks";
import { useEvent } from "@/features/events/hooks";
import { useEventFinancialSummary, useTransactions } from "@/features/transactions/hooks";

import { isExpenseTransaction } from "../lib/expenses-utils";

export function useExpensesData(eventId: string) {
  const eventQuery = useEvent(eventId);
  const txnsQuery = useTransactions({
    page: 1,
    page_size: 200,
    event_id: eventId,
    sort: "-transaction_date",
  });
  const summaryQuery = useEventFinancialSummary(eventId);
  const itemsQuery = useCostItems({
    page: 1,
    page_size: 200,
    event_id: eventId,
    sort: "title",
  });

  const transactions = txnsQuery.data?.data ?? [];
  const expenses = useMemo(
    () => transactions.filter((txn) => isExpenseTransaction(txn)),
    [transactions],
  );

  const itemTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of itemsQuery.data?.data ?? []) {
      map[item.id] = item.title;
    }
    return map;
  }, [itemsQuery.data?.data]);

  const isLoading =
    eventQuery.isLoading || txnsQuery.isLoading || summaryQuery.isLoading || itemsQuery.isLoading;
  const isError = eventQuery.isError || txnsQuery.isError || itemsQuery.isError;
  const error = eventQuery.error ?? txnsQuery.error ?? itemsQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void txnsQuery.refetch();
    void summaryQuery.refetch();
    void itemsQuery.refetch();
  };

  return {
    event: eventQuery.data,
    expenses,
    summary: summaryQuery.data,
    itemTitles,
    isLoading,
    isError,
    error,
    refetch,
  };
}

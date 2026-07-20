"use client";

import { useMemo } from "react";

import { useClientInvoices } from "@/features/client-invoices/hooks";
import { useEvent } from "@/features/events/hooks";

export function useInvoicesData(eventId: string) {
  const eventQuery = useEvent(eventId);
  const invoicesQuery = useClientInvoices({
    page: 1,
    page_size: 100,
    event_id: eventId,
    sort: "-created_at",
  });

  const invoices = useMemo(() => invoicesQuery.data?.data ?? [], [invoicesQuery.data?.data]);

  const isLoading = eventQuery.isLoading || invoicesQuery.isLoading;
  const isError = eventQuery.isError || invoicesQuery.isError;
  const error = eventQuery.error ?? invoicesQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void invoicesQuery.refetch();
  };

  return {
    event: eventQuery.data,
    invoices,
    isLoading,
    isError,
    error,
    refetch,
  };
}

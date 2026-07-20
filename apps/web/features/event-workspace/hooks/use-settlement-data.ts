"use client";

import { useMemo } from "react";

import { useEvent, useEventFinancialReadiness } from "@/features/events/hooks";
import { useEventFinancialSummary } from "@/features/transactions/hooks";

import { computeSettlementPnl } from "../lib/settlement-utils";

export function useSettlementData(eventId: string) {
  const eventQuery = useEvent(eventId);
  const summaryQuery = useEventFinancialSummary(eventId);
  const readinessEnabled =
    eventQuery.data?.status === "Settlement" || eventQuery.data?.status === "Closed";
  const readinessQuery = useEventFinancialReadiness(eventId, readinessEnabled);

  const pnl = useMemo(() => {
    if (!summaryQuery.data) return undefined;
    return computeSettlementPnl(summaryQuery.data);
  }, [summaryQuery.data]);

  const isLoading = eventQuery.isLoading || summaryQuery.isLoading;
  const isError = eventQuery.isError || summaryQuery.isError;
  const error = eventQuery.error ?? summaryQuery.error;

  const refetch = () => {
    void eventQuery.refetch();
    void summaryQuery.refetch();
    if (readinessEnabled) void readinessQuery.refetch();
  };

  return {
    event: eventQuery.data,
    summary: summaryQuery.data,
    readiness: readinessQuery.data,
    readinessLoading: readinessQuery.isLoading,
    readinessError: readinessQuery.error,
    pnl,
    isLoading,
    isError,
    error,
    refetch,
  };
}

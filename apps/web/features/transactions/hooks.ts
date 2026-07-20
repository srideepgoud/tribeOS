"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { transactionsService } from "@/services/transactions";
import type {
  ListTransactionsParams,
  TransactionCreateInput,
  TransactionUpdateInput,
} from "@/types/transaction";

const TXN_KEY = "transactions";

export function useTransactions(params: ListTransactionsParams, enabled = true) {
  return useQuery({
    queryKey: [TXN_KEY, params],
    queryFn: () => transactionsService.list(params),
    enabled:
      enabled &&
      (params.client_invoice_id !== undefined ? Boolean(params.client_invoice_id) : true),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionCreateInput) => transactionsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TXN_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["cost-items"] });
      void queryClient.invalidateQueries({ queryKey: ["event-financial-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TransactionUpdateInput }) =>
      transactionsService.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TXN_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["cost-items"] });
      void queryClient.invalidateQueries({ queryKey: ["event-financial-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["client-invoices"] });
    },
  });
}

export function useEventFinancialSummary(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-financial-summary", eventId],
    queryFn: () => transactionsService.eventFinancialSummary(eventId!),
    enabled: Boolean(eventId),
  });
}

export function useReplaceAllocations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      allocations,
    }: {
      id: string;
      allocations: { cost_item_id: string; allocated_amount: string }[];
    }) => transactionsService.replaceAllocations(id, { allocations }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TXN_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["cost-items"] });
      void queryClient.invalidateQueries({ queryKey: ["event-financial-summary"] });
    },
  });
}

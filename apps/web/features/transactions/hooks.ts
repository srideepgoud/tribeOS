"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { transactionsService } from "@/services/transactions";
import type {
  ListTransactionsParams,
  TransactionCreateInput,
  TransactionUpdateInput,
} from "@/types/transaction";

const TXN_KEY = "transactions";

export function useTransactions(params: ListTransactionsParams) {
  return useQuery({
    queryKey: [TXN_KEY, params],
    queryFn: () => transactionsService.list(params),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransactionCreateInput) => transactionsService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [TXN_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["cost-items"] });
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
    },
  });
}

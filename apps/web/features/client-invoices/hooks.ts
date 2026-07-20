"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientInvoicesService } from "@/services/client-invoices";
import type {
  ClientInvoiceCreateInput,
  ClientInvoiceUpdateInput,
  ListClientInvoicesParams,
} from "@/types/client-invoice";

const KEY = "client-invoices";

export function useClientInvoices(params: ListClientInvoicesParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => clientInvoicesService.list(params),
  });
}

export function useCreateClientInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInvoiceCreateInput) => clientInvoicesService.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY] });
      void queryClient.invalidateQueries({ queryKey: ["event-financial-summary"] });
    },
  });
}

export function useUpdateClientInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClientInvoiceUpdateInput }) =>
      clientInvoicesService.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY] });
      void queryClient.invalidateQueries({ queryKey: ["event-financial-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

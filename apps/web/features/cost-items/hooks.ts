"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { costItemsService } from "@/services/cost-items";
import type {
  CostItemCreateInput,
  CostItemUpdateInput,
  ListCostItemsParams,
} from "@/types/cost-item";

const KEY = "cost-items";

export function useCostItems(params: ListCostItemsParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => costItemsService.list(params),
  });
}

export function useCostItemVersions(itemId: string | null) {
  return useQuery({
    queryKey: [KEY, "versions", itemId],
    queryFn: () => costItemsService.listVersions(itemId!),
    enabled: Boolean(itemId),
  });
}

export function useCreateCostItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CostItemCreateInput) => costItemsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCostItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CostItemUpdateInput }) =>
      costItemsService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCostItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costItemsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

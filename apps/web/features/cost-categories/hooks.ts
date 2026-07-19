"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { costCategoriesService } from "@/services/cost-categories";
import type {
  CostCategoryCreateInput,
  CostCategoryUpdateInput,
  ListCostCategoriesParams,
} from "@/types/cost-category";

const KEY = "cost-categories";

export function useCostCategories(params: ListCostCategoriesParams) {
  return useQuery({
    queryKey: [KEY, params],
    queryFn: () => costCategoriesService.list(params),
  });
}

export function useCreateCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CostCategoryCreateInput) => costCategoriesService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CostCategoryUpdateInput }) =>
      costCategoriesService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteCostCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costCategoriesService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}

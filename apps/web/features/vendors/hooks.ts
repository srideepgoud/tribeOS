"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { vendorsService } from "@/services/vendors";
import type { ListVendorsParams, VendorCreateInput, VendorUpdateInput } from "@/types/vendor";

const VENDORS_KEY = "vendors";

export function useVendors(params: ListVendorsParams) {
  return useQuery({
    queryKey: [VENDORS_KEY, params],
    queryFn: () => vendorsService.list(params),
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorCreateInput) => vendorsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] }),
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorUpdateInput }) =>
      vendorsService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] }),
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VENDORS_KEY] }),
  });
}

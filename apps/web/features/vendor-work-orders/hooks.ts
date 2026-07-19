"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { vendorWorkOrdersService } from "@/services/vendor-work-orders";
import type {
  ListVendorWorkOrdersParams,
  VendorWorkOrderCreateInput,
  VendorWorkOrderUpdateInput,
} from "@/types/vendor-work-order";

const VWO_KEY = "vendor-work-orders";

export function useVendorWorkOrders(params: ListVendorWorkOrdersParams) {
  return useQuery({
    queryKey: [VWO_KEY, params],
    queryFn: () => vendorWorkOrdersService.list(params),
  });
}

export function useCreateVendorWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VendorWorkOrderCreateInput) => vendorWorkOrdersService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VWO_KEY] }),
  });
}

export function useUpdateVendorWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VendorWorkOrderUpdateInput }) =>
      vendorWorkOrdersService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [VWO_KEY] }),
  });
}

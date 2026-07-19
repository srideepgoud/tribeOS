"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { clientsService } from "@/services/clients";
import type { ClientCreateInput, ClientUpdateInput, ListClientsParams } from "@/types/client";

const CLIENTS_KEY = "clients";

export function useClients(params: ListClientsParams) {
  return useQuery({
    queryKey: [CLIENTS_KEY, params],
    queryFn: () => clientsService.list(params),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => clientsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ClientUpdateInput }) =>
      clientsService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [CLIENTS_KEY] }),
  });
}

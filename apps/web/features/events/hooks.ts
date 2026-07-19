"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { eventsService } from "@/services/events";
import type { EventCreateInput, EventUpdateInput, ListEventsParams } from "@/types/event";

const EVENTS_KEY = "events";

export function useEvents(params: ListEventsParams) {
  return useQuery({
    queryKey: [EVENTS_KEY, params],
    queryFn: () => eventsService.list(params),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventCreateInput) => eventsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EventUpdateInput }) =>
      eventsService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

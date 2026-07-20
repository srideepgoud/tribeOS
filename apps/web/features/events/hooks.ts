"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { eventsService } from "@/services/events";
import type { EventCreateInput, EventUpdateInput, ListEventsParams } from "@/types/event";

const EVENTS_KEY = "events";
const READINESS_KEY = "event-financial-readiness";

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: [EVENTS_KEY, eventId],
    queryFn: () => eventsService.get(eventId!),
    enabled: Boolean(eventId),
  });
}

export function useEvents(params: ListEventsParams) {
  return useQuery({
    queryKey: [EVENTS_KEY, params],
    queryFn: () => eventsService.list(params),
  });
}

export function useEventFinancialReadiness(eventId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [READINESS_KEY, eventId],
    queryFn: () => eventsService.financialReadiness(eventId!),
    enabled: Boolean(eventId) && enabled,
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
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [READINESS_KEY, variables.id] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [EVENTS_KEY] }),
  });
}

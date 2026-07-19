import type {
  Event,
  EventCreateInput,
  EventListResult,
  EventUpdateInput,
  ListEventsParams,
} from "@/types/event";

import { http } from "./http";

const BASE = "/api/v1/events";

function buildQuery(params: ListEventsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.status) search.set("status", params.status);
  if (params.client_id) search.set("client_id", params.client_id);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Events API client. The only place Event endpoints are called. */
export const eventsService = {
  async list(params: ListEventsParams = {}): Promise<EventListResult> {
    const result = await http.get<Event[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as EventListResult["meta"] };
  },
  async get(id: string): Promise<Event> {
    return (await http.get<Event>(`${BASE}/${id}`)).data;
  },
  async create(input: EventCreateInput): Promise<Event> {
    return (await http.post<Event>(BASE, input)).data;
  },
  async update(id: string, input: EventUpdateInput): Promise<Event> {
    return (await http.patch<Event>(`${BASE}/${id}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

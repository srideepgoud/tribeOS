import type {
  Client,
  ClientCreateInput,
  ClientListResult,
  ClientUpdateInput,
  ListClientsParams,
} from "@/types/client";

import { http } from "./http";

const BASE = "/api/v1/clients";

function buildQuery(params: ListClientsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Clients API client. The only place Client endpoints are called. */
export const clientsService = {
  async list(params: ListClientsParams = {}): Promise<ClientListResult> {
    const result = await http.get<Client[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as ClientListResult["meta"] };
  },
  async get(id: string): Promise<Client> {
    return (await http.get<Client>(`${BASE}/${id}`)).data;
  },
  async create(input: ClientCreateInput): Promise<Client> {
    return (await http.post<Client>(BASE, input)).data;
  },
  async update(id: string, input: ClientUpdateInput): Promise<Client> {
    return (await http.patch<Client>(`${BASE}/${id}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

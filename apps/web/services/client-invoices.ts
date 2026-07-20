import type {
  ClientInvoice,
  ClientInvoiceCreateInput,
  ClientInvoiceListResult,
  ClientInvoiceUpdateInput,
  ListClientInvoicesParams,
} from "@/types/client-invoice";

import { http } from "./http";

const BASE = "/api/v1/client-invoices";

function buildQuery(params: ListClientInvoicesParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.event_id) search.set("event_id", params.event_id);
  if (params.client_id) search.set("client_id", params.client_id);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Client Invoices API client. */
export const clientInvoicesService = {
  async list(params: ListClientInvoicesParams = {}): Promise<ClientInvoiceListResult> {
    const result = await http.get<ClientInvoice[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as ClientInvoiceListResult["meta"] };
  },
  async get(id: string): Promise<ClientInvoice> {
    return (await http.get<ClientInvoice>(`${BASE}/${id}`)).data;
  },
  async create(input: ClientInvoiceCreateInput): Promise<ClientInvoice> {
    return (await http.post<ClientInvoice>(BASE, input)).data;
  },
  async update(id: string, input: ClientInvoiceUpdateInput): Promise<ClientInvoice> {
    return (await http.patch<ClientInvoice>(`${BASE}/${id}`, input)).data;
  },
};

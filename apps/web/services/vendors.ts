import type {
  ListVendorsParams,
  Vendor,
  VendorCreateInput,
  VendorListResult,
  VendorUpdateInput,
} from "@/types/vendor";

import { http } from "./http";

const BASE = "/api/v1/vendors";

function buildQuery(params: ListVendorsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Vendors API client. The only place Vendor endpoints are called. */
export const vendorsService = {
  async list(params: ListVendorsParams = {}): Promise<VendorListResult> {
    const result = await http.get<Vendor[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as VendorListResult["meta"] };
  },
  async get(id: string): Promise<Vendor> {
    return (await http.get<Vendor>(`${BASE}/${id}`)).data;
  },
  async create(input: VendorCreateInput): Promise<Vendor> {
    return (await http.post<Vendor>(BASE, input)).data;
  },
  async update(id: string, input: VendorUpdateInput): Promise<Vendor> {
    return (await http.patch<Vendor>(`${BASE}/${id}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

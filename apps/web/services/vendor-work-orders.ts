import type {
  ListVendorWorkOrdersParams,
  VendorWorkOrder,
  VendorWorkOrderCreateInput,
  VendorWorkOrderListResult,
  VendorWorkOrderUpdateInput,
} from "@/types/vendor-work-order";

import { http } from "./http";

const BASE = "/api/v1/vendor-work-orders";

function buildQuery(params: ListVendorWorkOrdersParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.vendor_id) search.set("vendor_id", params.vendor_id);
  if (params.cost_item_id) search.set("cost_item_id", params.cost_item_id);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Vendor Work Orders API client. */
export const vendorWorkOrdersService = {
  async list(params: ListVendorWorkOrdersParams = {}): Promise<VendorWorkOrderListResult> {
    const result = await http.get<VendorWorkOrder[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as VendorWorkOrderListResult["meta"] };
  },
  async get(id: string): Promise<VendorWorkOrder> {
    return (await http.get<VendorWorkOrder>(`${BASE}/${id}`)).data;
  },
  async create(input: VendorWorkOrderCreateInput): Promise<VendorWorkOrder> {
    return (await http.post<VendorWorkOrder>(BASE, input)).data;
  },
  async update(id: string, input: VendorWorkOrderUpdateInput): Promise<VendorWorkOrder> {
    return (await http.patch<VendorWorkOrder>(`${BASE}/${id}`, input)).data;
  },
};

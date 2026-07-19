import type {
  CostItem,
  CostItemCreateInput,
  CostItemListResult,
  CostItemUpdateInput,
  CostItemVersion,
  ListCostItemsParams,
} from "@/types/cost-item";

import { http } from "./http";

const BASE = "/api/v1/cost-items";

function buildQuery(params: ListCostItemsParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.event_id) search.set("event_id", params.event_id);
  if (params.category_id) search.set("category_id", params.category_id);
  if (params.status) search.set("status", params.status);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const costItemsService = {
  async list(params: ListCostItemsParams = {}): Promise<CostItemListResult> {
    const result = await http.get<CostItem[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as CostItemListResult["meta"] };
  },
  async get(id: string): Promise<CostItem> {
    return (await http.get<CostItem>(`${BASE}/${id}`)).data;
  },
  async listVersions(id: string): Promise<CostItemVersion[]> {
    return (await http.get<CostItemVersion[]>(`${BASE}/${id}/versions`)).data;
  },
  async create(input: CostItemCreateInput): Promise<CostItem> {
    return (await http.post<CostItem>(BASE, input)).data;
  },
  async update(id: string, input: CostItemUpdateInput): Promise<CostItem> {
    return (await http.patch<CostItem>(`${BASE}/${id}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

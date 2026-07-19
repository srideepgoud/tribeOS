import type {
  CostCategory,
  CostCategoryCreateInput,
  CostCategoryListResult,
  CostCategoryUpdateInput,
  ListCostCategoriesParams,
} from "@/types/cost-category";

import { http } from "./http";

const BASE = "/api/v1/cost-categories";

function buildQuery(params: ListCostCategoriesParams): string {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.page_size) search.set("page_size", String(params.page_size));
  if (params.q) search.set("q", params.q);
  if (params.sort) search.set("sort", params.sort);
  if (params.event_id) search.set("event_id", params.event_id);
  const query = search.toString();
  return query ? `?${query}` : "";
}

/** Typed Cost Categories API client. */
export const costCategoriesService = {
  async list(params: ListCostCategoriesParams = {}): Promise<CostCategoryListResult> {
    const result = await http.get<CostCategory[]>(`${BASE}${buildQuery(params)}`);
    return { data: result.data, meta: result.meta as CostCategoryListResult["meta"] };
  },
  async get(id: string): Promise<CostCategory> {
    return (await http.get<CostCategory>(`${BASE}/${id}`)).data;
  },
  async create(input: CostCategoryCreateInput): Promise<CostCategory> {
    return (await http.post<CostCategory>(BASE, input)).data;
  },
  async update(id: string, input: CostCategoryUpdateInput): Promise<CostCategory> {
    return (await http.patch<CostCategory>(`${BASE}/${id}`, input)).data;
  },
  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}/${id}`);
  },
};

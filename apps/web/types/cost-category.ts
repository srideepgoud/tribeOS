/** Cost Category resource (docs/db_schema.md — cost_categories). */

export interface CostCategory {
  id: string;
  event_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CostCategoryCreateInput {
  event_id: string;
  name: string;
  display_order?: number;
}

export type CostCategoryUpdateInput = Partial<CostCategoryCreateInput>;

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListCostCategoriesParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  event_id?: string;
}

export interface CostCategoryListResult {
  data: CostCategory[];
  meta: { pagination: PaginationMeta };
}

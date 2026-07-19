/** Cost Item resource (docs/db_schema.md — cost_items). */

export const EXPENSE_TYPES = ["Vendor", "Internal", "Shared"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const COST_ITEM_STATUSES = [
  "Planned",
  "Approved",
  "In Progress",
  "Completed",
  "Cancelled",
] as const;
export type CostItemStatus = (typeof COST_ITEM_STATUSES)[number];

export interface CostItem {
  id: string;
  event_id: string;
  category_id: string;
  title: string;
  description: string | null;
  expense_type: ExpenseType;
  budget_amount: string;
  negotiated_amount: string | null;
  actual_amount: string | null;
  vendor_required: boolean;
  status: CostItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface CostItemVersion {
  id: string;
  cost_item_id: string;
  version_number: number;
  budget_amount: string;
  negotiated_amount: string | null;
  actual_amount: string | null;
  change_reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface CostItemCreateInput {
  event_id: string;
  category_id: string;
  title: string;
  description?: string | null;
  expense_type: ExpenseType;
  budget_amount: string;
  negotiated_amount?: string | null;
  vendor_required?: boolean;
  notes?: string | null;
}

export type CostItemUpdateInput = Partial<CostItemCreateInput> & {
  status?: CostItemStatus;
};

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListCostItemsParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  event_id?: string;
  category_id?: string;
  status?: CostItemStatus;
}

export interface CostItemListResult {
  data: CostItem[];
  meta: { pagination: PaginationMeta };
}

export const ALLOWED_COST_ITEM_TRANSITIONS: Record<
  CostItemStatus,
  readonly CostItemStatus[]
> = {
  Planned: ["Approved", "Cancelled"],
  Approved: ["In Progress", "Cancelled"],
  "In Progress": ["Completed"],
  Completed: [],
  Cancelled: [],
};

export function isCostItemReadOnly(status: CostItemStatus): boolean {
  return status === "Completed" || status === "Cancelled";
}

export function isBudgetFrozen(status: CostItemStatus): boolean {
  return status !== "Planned";
}

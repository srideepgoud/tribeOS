/** Vendor Work Order resource (docs/db_schema.md — vendor_work_orders). */

export const VENDOR_WORK_ORDER_STATUSES = [
  "Draft",
  "Approved",
  "Issued",
  "In Progress",
  "Completed",
  "Cancelled",
] as const;

export type VendorWorkOrderStatus = (typeof VENDOR_WORK_ORDER_STATUSES)[number];

export interface VendorWorkOrder {
  id: string;
  cost_item_id: string;
  vendor_id: string;
  work_order_number: string;
  scope: string | null;
  agreed_amount: string;
  issue_date: string | null;
  expected_completion: string | null;
  version: number;
  status: VendorWorkOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface VendorWorkOrderCreateInput {
  cost_item_id: string;
  vendor_id: string;
  scope?: string | null;
  agreed_amount?: string | null;
  issue_date?: string | null;
  expected_completion?: string | null;
}

export type VendorWorkOrderUpdateInput = Partial<
  Omit<VendorWorkOrderCreateInput, "cost_item_id">
> & {
  status?: VendorWorkOrderStatus;
};

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListVendorWorkOrdersParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  vendor_id?: string;
  cost_item_id?: string;
  status?: VendorWorkOrderStatus;
}

export interface VendorWorkOrderListResult {
  data: VendorWorkOrder[];
  meta: { pagination: PaginationMeta };
}

/** Mirrors backend ALLOWED_TRANSITIONS for UI affordances. */
export const ALLOWED_VWO_TRANSITIONS: Record<
  VendorWorkOrderStatus,
  readonly VendorWorkOrderStatus[]
> = {
  Draft: ["Approved", "Cancelled"],
  Approved: ["Issued", "Cancelled"],
  Issued: ["In Progress"],
  "In Progress": ["Completed"],
  Completed: [],
  Cancelled: [],
};

export const ACTIVE_VWO_STATUSES: readonly VendorWorkOrderStatus[] = [
  "Draft",
  "Approved",
  "Issued",
  "In Progress",
];

export function isCommercialLocked(status: VendorWorkOrderStatus): boolean {
  return status === "Issued" || status === "In Progress" || status === "Completed" || status === "Cancelled";
}

export function isTerminalVwoStatus(status: VendorWorkOrderStatus): boolean {
  return status === "Completed" || status === "Cancelled";
}

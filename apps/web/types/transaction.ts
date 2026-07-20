/** Transaction resource (docs/db_schema.md — transactions). */

export const TRANSACTION_TYPES = [
  "Vendor Payment",
  "Internal Expense",
  "Reversal",
  "Client Receipt",
  "Refund",
  "Adjustment",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PHASE9_CREATE_TYPES = [
  "Vendor Payment",
  "Internal Expense",
  "Client Receipt",
] as const;

export type Phase9CreateType = (typeof PHASE9_CREATE_TYPES)[number];

/** @deprecated Use PHASE9_CREATE_TYPES */
export const PHASE7_CREATE_TYPES = ["Vendor Payment", "Internal Expense"] as const;

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Cash",
  "Cheque",
  "UPI",
  "Card",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRANSACTION_STATUSES = ["Pending", "Completed", "Failed", "Reversed"] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface Transaction {
  id: string;
  event_id: string;
  cost_item_id: string | null;
  work_order_id: string | null;
  client_invoice_id: string | null;
  reverses_transaction_id: string | null;
  transaction_type: TransactionType;
  payment_method: PaymentMethod;
  amount: string;
  transaction_date: string;
  reference_number: string | null;
  status: TransactionStatus;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionCreateInput {
  event_id: string;
  cost_item_id?: string | null;
  work_order_id?: string | null;
  client_invoice_id?: string | null;
  transaction_type: "Vendor Payment" | "Internal Expense" | "Client Receipt";
  payment_method: PaymentMethod;
  amount: string;
  transaction_date: string;
  reference_number?: string | null;
  remarks?: string | null;
  allocations?: { cost_item_id: string; allocated_amount: string }[] | null;
}

export type TransactionUpdateInput = {
  cost_item_id?: string | null;
  work_order_id?: string | null;
  payment_method?: PaymentMethod;
  amount?: string;
  transaction_date?: string;
  reference_number?: string | null;
  remarks?: string | null;
  status?: TransactionStatus;
  allocations?: { cost_item_id: string; allocated_amount: string }[] | null;
};

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListTransactionsParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  event_id?: string;
  cost_item_id?: string;
  work_order_id?: string;
  client_invoice_id?: string;
  transaction_type?: TransactionType;
  status?: TransactionStatus;
}

export interface TransactionListResult {
  data: Transaction[];
  meta: { pagination: PaginationMeta };
}

export const ALLOWED_TRANSACTION_TRANSITIONS: Record<
  TransactionStatus,
  readonly TransactionStatus[]
> = {
  Pending: ["Completed", "Failed"],
  Failed: ["Pending"],
  Completed: ["Reversed"],
  Reversed: [],
};

export function isPendingEditable(status: TransactionStatus): boolean {
  return status === "Pending";
}

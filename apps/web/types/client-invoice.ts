/** Client Invoice resource (docs/db_schema.md — client_invoices, ADR 0013). */

export const CLIENT_INVOICE_STATUSES = [
  "Draft",
  "Issued",
  "Partially Paid",
  "Paid",
  "Cancelled",
] as const;

export type ClientInvoiceStatus = (typeof CLIENT_INVOICE_STATUSES)[number];

/** User-settable statuses only — Partially Paid / Paid are system-derived. */
export const CLIENT_INVOICE_USER_ACTIONS = ["Issued", "Cancelled"] as const;

export type ClientInvoiceUserAction = (typeof CLIENT_INVOICE_USER_ACTIONS)[number];

export interface ClientInvoice {
  readonly id: string;
  readonly event_id: string;
  readonly client_id: string;
  readonly invoice_number: string;
  readonly invoice_date: string;
  readonly due_date: string | null;
  readonly amount: string;
  readonly gst_amount: string;
  readonly total_amount: string;
  readonly status: ClientInvoiceStatus;
  readonly notes: string | null;
  readonly outstanding: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface ClientInvoiceCreateInput {
  event_id: string;
  client_id: string;
  invoice_date: string;
  due_date?: string | null;
  amount: string;
  gst_amount?: string;
  total_amount: string;
  notes?: string | null;
}

export type ClientInvoiceUpdateInput = {
  event_id?: string;
  client_id?: string;
  invoice_date?: string;
  due_date?: string | null;
  amount?: string;
  gst_amount?: string;
  total_amount?: string;
  notes?: string | null;
  status?: ClientInvoiceUserAction;
};

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListClientInvoicesParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  event_id?: string;
  client_id?: string;
  status?: ClientInvoiceStatus;
}

export interface ClientInvoiceListResult {
  data: ClientInvoice[];
  meta: { pagination: PaginationMeta };
}

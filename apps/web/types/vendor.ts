/** Vendor resource as returned by the API (see docs/db_schema.md — vendors). */
export interface Vendor {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  gst_number: string | null;
  pan_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface VendorCreateInput {
  company_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc?: string | null;
  notes?: string | null;
}

export type VendorUpdateInput = Partial<VendorCreateInput>;

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListVendorsParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
}

export interface VendorListResult {
  data: Vendor[];
  meta: { pagination: PaginationMeta };
}

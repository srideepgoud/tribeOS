/** Client resource as returned by the API (see docs/db_schema.md — clients). */
export interface Client {
  id: string;
  company_name: string;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface ClientCreateInput {
  company_name: string;
  gst_number?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  notes?: string | null;
}

export type ClientUpdateInput = Partial<ClientCreateInput>;

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListClientsParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
}

export interface ClientListResult {
  data: Client[];
  meta: { pagination: PaginationMeta };
}

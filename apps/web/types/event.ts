/** Event resource as returned by the API (docs/db_schema.md — events). */

export const EVENT_STATUSES = [
  "Draft",
  "Planning",
  "Commercials",
  "Procurement",
  "Execution",
  "Settlement",
  "Closed",
  "Cancelled",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface Event {
  id: string;
  client_id: string;
  name: string;
  venue: string | null;
  city: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  expected_revenue: string | null;
  status: EventStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface EventCreateInput {
  client_id: string;
  name: string;
  venue?: string | null;
  city?: string | null;
  start_datetime?: string | null;
  end_datetime?: string | null;
  expected_revenue?: string | null;
  notes?: string | null;
}

export type EventUpdateInput = Partial<EventCreateInput> & {
  status?: EventStatus;
};

export interface PaginationMeta {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface ListEventsParams {
  page?: number;
  page_size?: number;
  q?: string;
  sort?: string;
  status?: EventStatus;
  client_id?: string;
}

export interface EventListResult {
  data: Event[];
  meta: { pagination: PaginationMeta };
}

/** Settlement → Closed readiness (Phase 10). Informational only. */
export interface FinancialReadinessChecks {
  readonly outstanding: boolean;
  readonly unattributed_spend: boolean;
  readonly pending_transactions: boolean;
}

export interface FinancialReadiness {
  readonly ready: boolean;
  readonly checks: FinancialReadinessChecks;
  readonly blocking_reasons: string[];
}

/** Mirrors backend ALLOWED_TRANSITIONS for UI affordances. */
export const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  Draft: ["Planning", "Cancelled"],
  Planning: ["Commercials", "Cancelled"],
  Commercials: ["Procurement", "Cancelled"],
  Procurement: ["Execution", "Cancelled"],
  Execution: ["Settlement"],
  Settlement: ["Closed"],
  Closed: [],
  Cancelled: [],
};

export function isEventReadOnly(status: EventStatus): boolean {
  return status === "Closed" || status === "Cancelled";
}

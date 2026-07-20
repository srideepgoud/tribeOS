/** Operations Dashboard payload (GET /api/v1/dashboard/operations). */

import type { EventStatus } from "./event";

export interface DashboardOverview {
  readonly active_events: number;
  readonly settlement_events: number;
  readonly closed_events: number;
  readonly ready_to_close: number;
}

export interface DashboardFinance {
  readonly billed_revenue: string;
  readonly cash_received: string;
  readonly outstanding: string;
  readonly cash_spent: string;
  readonly attributed_cost: string;
  readonly gross_profit: string;
}

export interface DashboardAttention {
  readonly outstanding_events: number;
  readonly pending_transactions: number;
  readonly unattributed_events: number;
  readonly ready_to_close_events: number;
}

export interface DashboardEventRow {
  readonly id: string;
  readonly name: string;
  readonly status: EventStatus;
  readonly client_name: string;
  readonly billed_revenue: string;
  readonly cash_received: string;
  readonly outstanding: string;
  readonly attributed_cost: string;
  readonly gross_profit: string;
  readonly financial_ready: boolean;
}

export interface OperationsDashboard {
  readonly overview: DashboardOverview;
  readonly finance: DashboardFinance;
  readonly attention: DashboardAttention;
  readonly events: readonly DashboardEventRow[];
}

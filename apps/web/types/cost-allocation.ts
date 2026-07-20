/** Cost Allocation resource (docs/db_schema.md — cost_allocations). */

export const ATTRIBUTION_STATES = [
  "Unattributed",
  "Partially Attributed",
  "Fully Attributed",
] as const;

export type AttributionState = (typeof ATTRIBUTION_STATES)[number];

export interface CostAllocation {
  readonly id: string;
  readonly transaction_id: string;
  readonly cost_item_id: string;
  readonly allocated_amount: string;
}

export interface CostAllocationLineInput {
  cost_item_id: string;
  allocated_amount: string;
}

export interface CostAllocationReplaceInput {
  allocations: CostAllocationLineInput[];
}

export interface EventFinancialSummary {
  readonly event_id: string;
  readonly cash_spent: string;
  readonly attributed_cost: string;
  readonly unattributed_spend: string;
  readonly billed_revenue: string;
  readonly cash_received: string;
  readonly outstanding: string;
}

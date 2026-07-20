import type { EventFinancialSummary } from "@/types/cost-allocation";
import type { EventStatus, FinancialReadiness } from "@/types/event";

export interface SettlementPnl {
  readonly billedRevenue: number;
  readonly attributedCost: number;
  readonly profit: number;
  readonly marginPercent: number | null;
}

export function computeSettlementPnl(summary: EventFinancialSummary): SettlementPnl {
  const billedRevenue = Number(summary.billed_revenue);
  const attributedCost = Number(summary.attributed_cost);
  const profit = billedRevenue - attributedCost;
  const marginPercent = billedRevenue > 0 ? (profit / billedRevenue) * 100 : null;
  return { billedRevenue, attributedCost, profit, marginPercent };
}

export const GATE_FIX_SEGMENTS: Record<keyof FinancialReadiness["checks"], string> = {
  outstanding: "invoices",
  unattributed_spend: "expenses",
  pending_transactions: "expenses",
};

export function gateHref(eventId: string, key: keyof FinancialReadiness["checks"]): string {
  return `/events/${eventId}/${GATE_FIX_SEGMENTS[key]}`;
}

export function isBudgetFrozen(eventStatus: EventStatus): boolean {
  return eventStatus === "Settlement" || eventStatus === "Closed";
}

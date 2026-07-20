import { describe, expect, it } from "vitest";

import {
  computeSettlementPnl,
  gateHref,
  isBudgetFrozen,
} from "@/features/event-workspace/lib/settlement-utils";
import type { EventFinancialSummary } from "@/types/cost-allocation";

const summary: EventFinancialSummary = {
  event_id: "event-1",
  cash_spent: "50000.00",
  attributed_cost: "45000.00",
  unattributed_spend: "5000.00",
  billed_revenue: "100000.00",
  cash_received: "80000.00",
  outstanding: "20000.00",
};

describe("settlement utils", () => {
  it("computes derived profit and margin", () => {
    const pnl = computeSettlementPnl(summary);
    expect(pnl.billedRevenue).toBe(100000);
    expect(pnl.attributedCost).toBe(45000);
    expect(pnl.profit).toBe(55000);
    expect(pnl.marginPercent).toBeCloseTo(55);
  });

  it("builds gate fix links", () => {
    expect(gateHref("event-1", "outstanding")).toBe("/events/event-1/invoices");
    expect(gateHref("event-1", "unattributed_spend")).toBe("/events/event-1/expenses");
  });

  it("detects frozen budget phases", () => {
    expect(isBudgetFrozen("Settlement")).toBe(true);
    expect(isBudgetFrozen("Closed")).toBe(true);
    expect(isBudgetFrozen("Execution")).toBe(false);
  });
});

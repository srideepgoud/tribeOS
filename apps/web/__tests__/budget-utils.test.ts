import { describe, expect, it } from "vitest";

import {
  buildCommittedByLineId,
  computeBudgetTotals,
  computeLineAttribution,
  computeLineTotals,
  groupBudgetSections,
  isBudgetEditable,
  nextSectionDisplayOrder,
  parseBudgetAmount,
} from "@/features/event-workspace/lib/budget-utils";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
import type { Transaction } from "@/types/transaction";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

const section: CostCategory = {
  id: "cat-1",
  event_id: "event-1",
  name: "Production",
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

const line: CostItem = {
  id: "line-1",
  event_id: "event-1",
  category_id: "cat-1",
  title: "LED Wall",
  description: null,
  expense_type: "Vendor",
  budget_amount: "300000.00",
  negotiated_amount: null,
  actual_amount: "275000.00",
  vendor_required: true,
  status: "In Progress",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

const workOrder: VendorWorkOrder = {
  id: "wo-1",
  cost_item_id: "line-1",
  vendor_id: "vendor-1",
  work_order_number: "WO-001",
  scope: null,
  agreed_amount: "280000.00",
  issue_date: null,
  expected_completion: null,
  version: 1,
  status: "Issued",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("budget utils", () => {
  it("allows editing during Commercials through Execution", () => {
    expect(isBudgetEditable("Commercials")).toBe(true);
    expect(isBudgetEditable("Execution")).toBe(true);
    expect(isBudgetEditable("Settlement")).toBe(false);
    expect(isBudgetEditable("Planning")).toBe(false);
  });

  it("parses valid budget amounts", () => {
    expect(parseBudgetAmount("1500")).toBe("1500.00");
    expect(parseBudgetAmount("-1")).toBeNull();
    expect(parseBudgetAmount("")).toBeNull();
  });

  it("computes committed totals from work orders", () => {
    const committed = buildCommittedByLineId([workOrder]);
    expect(committed["line-1"]).toBe(280000);
    expect(computeLineTotals(line, committed).variance).toBe(25000);
  });

  it("groups sections and totals", () => {
    const committed = buildCommittedByLineId([workOrder]);
    const groups = groupBudgetSections([section], [line], committed);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lines).toHaveLength(1);
    expect(computeBudgetTotals([line], committed).planned).toBe(300000);
  });

  it("calculates the next section display order", () => {
    expect(nextSectionDisplayOrder([])).toBe(0);
    expect(nextSectionDisplayOrder([section])).toBe(1);
  });

  it("derives line attribution state", () => {
    const expense: Transaction = {
      id: "txn-1",
      event_id: "event-1",
      cost_item_id: "line-1",
      work_order_id: null,
      client_invoice_id: null,
      reverses_transaction_id: null,
      transaction_type: "Internal Expense",
      payment_method: "UPI",
      amount: "50000.00",
      transaction_date: "2026-06-01",
      reference_number: null,
      status: "Completed",
      remarks: "Transport",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(computeLineAttribution(line, []).state).toBe("No spend");
    expect(computeLineAttribution({ ...line, actual_amount: "0" }, [expense]).state).toBe(
      "Unattributed",
    );
    expect(computeLineAttribution(line, [expense]).state).toBe("Fully Attributed");
  });
});

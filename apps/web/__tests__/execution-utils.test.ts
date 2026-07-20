import { describe, expect, it } from "vitest";

import {
  executionCoverage,
  filterExecutionGroups,
  groupExecutionBySection,
} from "@/features/event-workspace/lib/execution-utils";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
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

const vendorLine: CostItem = {
  id: "line-1",
  event_id: "event-1",
  category_id: "cat-1",
  title: "LED Wall",
  description: null,
  expense_type: "Vendor",
  budget_amount: "300000.00",
  negotiated_amount: null,
  actual_amount: null,
  vendor_required: true,
  status: "Planned",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

const internalLine: CostItem = {
  ...vendorLine,
  id: "line-2",
  title: "Staff meals",
  expense_type: "Internal",
  vendor_required: false,
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

describe("execution utils", () => {
  it("groups vendor lines by section with work orders", () => {
    const groups = groupExecutionBySection([section], [vendorLine, internalLine], [workOrder]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.lines).toHaveLength(1);
    expect(groups[0]?.lines[0]?.covered).toBe(true);
    expect(groups[0]?.lines[0]?.workOrders).toHaveLength(1);
  });

  it("calculates vendor coverage", () => {
    const groups = groupExecutionBySection([section], [vendorLine], []);
    expect(executionCoverage(groups)).toEqual({
      covered: 0,
      total: 1,
      committed: 0,
      planned: 300000,
    });
  });

  it("filters groups by search and status", () => {
    const groups = groupExecutionBySection([section], [vendorLine], [workOrder]);
    const filtered = filterExecutionGroups(groups, {
      search: "WO-001",
      status: "all",
      vendorNames: { "vendor-1": "ABC Productions" },
    });
    expect(filtered[0]?.lines[0]?.workOrders).toHaveLength(1);

    const empty = filterExecutionGroups(groups, {
      search: "",
      status: "Draft",
      vendorNames: {},
    });
    expect(empty).toHaveLength(0);
  });
});

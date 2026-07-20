import { describe, expect, it } from "vitest";

import {
  buildTimelineEntries,
  filterTimelineEntries,
} from "@/features/event-workspace/lib/timeline-utils";
import type { ClientInvoice } from "@/types/client-invoice";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
import type { Event } from "@/types/event";
import type { Transaction } from "@/types/transaction";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

const event: Event = {
  id: "event-1",
  client_id: "client-1",
  name: "Summer Gala",
  venue: null,
  city: null,
  start_datetime: null,
  end_datetime: null,
  expected_revenue: null,
  status: "Execution",
  notes: null,
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z",
  archived_at: null,
};

const section: CostCategory = {
  id: "section-1",
  event_id: "event-1",
  name: "Production",
  display_order: 1,
  created_at: "2026-06-02T10:00:00Z",
  updated_at: "2026-06-02T10:00:00Z",
  archived_at: null,
};

const line: CostItem = {
  id: "line-1",
  event_id: "event-1",
  category_id: "section-1",
  title: "Stage build",
  description: null,
  expense_type: "Vendor",
  budget_amount: "10000.00",
  negotiated_amount: null,
  actual_amount: null,
  vendor_required: true,
  status: "Approved",
  notes: null,
  created_at: "2026-06-03T10:00:00Z",
  updated_at: "2026-06-03T10:00:00Z",
  archived_at: null,
};

const workOrder: VendorWorkOrder = {
  id: "wo-1",
  cost_item_id: "line-1",
  vendor_id: "vendor-1",
  work_order_number: "WO-001",
  scope: null,
  agreed_amount: "9000.00",
  issue_date: null,
  expected_completion: null,
  version: 1,
  status: "Issued",
  created_at: "2026-06-04T10:00:00Z",
  updated_at: "2026-06-04T10:00:00Z",
};

const expense: Transaction = {
  id: "txn-1",
  event_id: "event-1",
  cost_item_id: "line-1",
  work_order_id: "wo-1",
  client_invoice_id: null,
  reverses_transaction_id: null,
  transaction_type: "Vendor Payment",
  payment_method: "UPI",
  amount: "5000.00",
  transaction_date: "2026-06-05",
  reference_number: null,
  status: "Completed",
  remarks: null,
  created_at: "2026-06-05T10:00:00Z",
  updated_at: "2026-06-05T10:00:00Z",
};

const invoice: ClientInvoice = {
  id: "inv-1",
  event_id: "event-1",
  client_id: "client-1",
  invoice_number: "INV-001",
  invoice_date: "2026-06-06",
  due_date: null,
  amount: "10000.00",
  gst_amount: "1800.00",
  total_amount: "11800.00",
  status: "Issued",
  notes: null,
  outstanding: "11800.00",
  created_at: "2026-06-06T10:00:00Z",
  updated_at: "2026-06-06T10:00:00Z",
};

describe("timeline utils", () => {
  it("builds reverse-chronological activity entries", () => {
    const entries = buildTimelineEntries({
      eventId: "event-1",
      event,
      categories: [section],
      costItems: [line],
      workOrders: [workOrder],
      transactions: [expense],
      invoices: [invoice],
      itemTitles: { "line-1": "Stage build" },
      vendorNames: { "vendor-1": "Acme AV" },
    });

    expect(entries[0]?.entityType).toBe("invoice");
    expect(entries.some((entry) => entry.entityType === "work_order")).toBe(true);
    expect(entries.at(-1)?.title).toBe("Event created");
  });

  it("filters entries by facet", () => {
    const entries = buildTimelineEntries({
      eventId: "event-1",
      event,
      categories: [section],
      costItems: [line],
      workOrders: [workOrder],
      transactions: [expense],
      invoices: [invoice],
      itemTitles: { "line-1": "Stage build" },
      vendorNames: { "vendor-1": "Acme AV" },
    });

    const budgetOnly = filterTimelineEntries(entries, "budget");
    expect(budgetOnly.every((entry) => entry.entityType.includes("budget"))).toBe(true);

    const executionOnly = filterTimelineEntries(entries, "execution");
    expect(executionOnly).toHaveLength(1);
    expect(executionOnly[0]?.entityType).toBe("work_order");
  });
});

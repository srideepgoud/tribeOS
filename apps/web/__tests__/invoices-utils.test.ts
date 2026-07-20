import { describe, expect, it } from "vitest";

import {
  filterInvoices,
  invoiceCollectionSummary,
} from "@/features/event-workspace/lib/invoices-utils";
import type { ClientInvoice } from "@/types/client-invoice";

const draftInvoice: ClientInvoice = {
  id: "inv-1",
  event_id: "event-1",
  client_id: "client-1",
  invoice_number: "INV-001",
  invoice_date: "2026-06-01",
  due_date: null,
  amount: "1000.00",
  gst_amount: "180.00",
  total_amount: "1180.00",
  status: "Draft",
  notes: "Kickoff billing",
  outstanding: "1180.00",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const paidInvoice: ClientInvoice = {
  ...draftInvoice,
  id: "inv-2",
  invoice_number: "INV-002",
  status: "Paid",
  notes: "Final settlement claim",
  outstanding: "0.00",
  total_amount: "2360.00",
};

describe("invoices utils", () => {
  it("summarizes billed, outstanding, and collected values", () => {
    const summary = invoiceCollectionSummary([draftInvoice, paidInvoice]);
    expect(summary.total).toBe(3540);
    expect(summary.outstanding).toBe(1180);
    expect(summary.collected).toBe(2360);
  });

  it("filters by query and status", () => {
    const byStatus = filterInvoices([draftInvoice, paidInvoice], {
      query: "",
      status: "Paid",
    });
    expect(byStatus).toHaveLength(1);
    expect(byStatus[0]?.invoice_number).toBe("INV-002");

    const byQuery = filterInvoices([draftInvoice, paidInvoice], {
      query: "kickoff",
      status: "all",
    });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0]?.invoice_number).toBe("INV-001");
  });
});

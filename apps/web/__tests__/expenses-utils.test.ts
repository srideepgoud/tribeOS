import { describe, expect, it } from "vitest";

import {
  allocationHint,
  filterExpenses,
  transactionFacet,
} from "@/features/event-workspace/lib/expenses-utils";
import type { Transaction } from "@/types/transaction";

const vendorPayment: Transaction = {
  id: "txn-1",
  event_id: "event-1",
  cost_item_id: "line-1",
  work_order_id: "wo-1",
  client_invoice_id: null,
  reverses_transaction_id: null,
  transaction_type: "Vendor Payment",
  payment_method: "Bank Transfer",
  amount: "1000.00",
  transaction_date: "2026-06-01",
  reference_number: "VP-001",
  status: "Completed",
  remarks: "Advance",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const refund: Transaction = {
  ...vendorPayment,
  id: "txn-2",
  transaction_type: "Refund",
  payment_method: "UPI",
  reference_number: "RF-001",
  cost_item_id: null,
  status: "Pending",
};

const clientReceipt: Transaction = {
  ...vendorPayment,
  id: "txn-3",
  transaction_type: "Client Receipt",
};

describe("expenses utils", () => {
  it("maps transaction facets", () => {
    expect(transactionFacet(vendorPayment)).toBe("Vendor Payments");
    expect(transactionFacet(refund)).toBe("Reimbursements");
  });

  it("filters only expense transactions and applies filters", () => {
    const result = filterExpenses([vendorPayment, refund, clientReceipt], {
      search: "vp-001",
      status: "all",
      facet: "all",
      paymentMethod: "all",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("txn-1");
  });

  it("derives allocation hints", () => {
    expect(allocationHint(vendorPayment)).toBe("Attributed");
    expect(allocationHint(refund)).toBe("Pending");
    expect(allocationHint({ ...vendorPayment, cost_item_id: null })).toBe("Review allocations");
  });
});

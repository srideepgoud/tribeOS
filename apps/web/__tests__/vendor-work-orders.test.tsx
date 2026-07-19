import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VendorWorkOrderFormDialog } from "@/features/vendor-work-orders/components/vwo-form-dialog";
import { VendorWorkOrderTable } from "@/features/vendor-work-orders/components/vwo-table";
import { VendorWorkOrdersEmptyState } from "@/features/vendor-work-orders/components/vwo-empty-state";
import { VendorWorkOrderStatusBadge } from "@/features/vendor-work-orders/components/vwo-status-badge";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sample: VendorWorkOrder = {
  id: "33333333-3333-3333-3333-333333333333",
  cost_item_id: "44444444-4444-4444-4444-444444444444",
  vendor_id: "55555555-5555-5555-5555-555555555555",
  work_order_number: "WO-ABC123DEF456",
  scope: "Full PA",
  agreed_amount: "45000.00",
  issue_date: null,
  expected_completion: null,
  version: 1,
  status: "Draft",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("vendor work orders feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<VendorWorkOrdersEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add work order/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a work order row with status badge", () => {
    render(
      <VendorWorkOrderTable
        workOrders={[sample]}
        vendorNames={{ [sample.vendor_id]: "Audio Pro" }}
        costItemTitles={{ [sample.cost_item_id]: "PA System" }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("WO-ABC123DEF456")).toBeInTheDocument();
    expect(screen.getByText("Audio Pro")).toBeInTheDocument();
    expect(screen.getByText("PA System")).toBeInTheDocument();
    render(<VendorWorkOrderStatusBadge status="Issued" />);
    expect(screen.getByText("Issued")).toBeInTheDocument();
  });

  it("shows validation when cost item and vendor are missing", async () => {
    renderWithClient(<VendorWorkOrderFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create work order/i }));
    expect(await screen.findByText("Select a Cost Item")).toBeInTheDocument();
  });
});

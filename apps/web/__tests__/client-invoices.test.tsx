import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientInvoiceFormDialog } from "@/features/client-invoices/components/invoice-form-dialog";
import { ClientInvoicesEmptyState } from "@/features/client-invoices/components/invoice-states";
import { ClientInvoiceStatusBadge } from "@/features/client-invoices/components/invoice-status-badge";
import { ClientInvoiceTable } from "@/features/client-invoices/components/invoice-table";
import type { ClientInvoice } from "@/types/client-invoice";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sample: ClientInvoice = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  event_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  client_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  invoice_number: "INV-TEST00000001",
  invoice_date: "2026-07-01",
  due_date: null,
  amount: "100000.00",
  gst_amount: "0.00",
  total_amount: "100000.00",
  status: "Issued",
  notes: null,
  outstanding: "100000.00",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("client invoices feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<ClientInvoicesEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add invoice/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders invoice row with outstanding and status", () => {
    render(
      <ClientInvoiceTable
        invoices={[sample]}
        eventNames={{ [sample.event_id]: "Gala" }}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText("INV-TEST00000001")).toBeInTheDocument();
    expect(screen.getByText("Gala")).toBeInTheDocument();
    expect(screen.getAllByText("100000.00").length).toBeGreaterThanOrEqual(1);
    render(<ClientInvoiceStatusBadge status="Partially Paid" />);
    expect(screen.getByText("Partially Paid")).toBeInTheDocument();
  });

  it("shows validation when event is missing", async () => {
    renderWithClient(<ClientInvoiceFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create invoice/i }));
    expect(await screen.findByText("Select an Event")).toBeInTheDocument();
  });
});

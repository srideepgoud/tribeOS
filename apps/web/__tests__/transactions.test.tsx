import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TransactionFormDialog } from "@/features/transactions/components/txn-form-dialog";
import { TransactionTable } from "@/features/transactions/components/txn-table";
import { TransactionsEmptyState } from "@/features/transactions/components/txn-empty-state";
import { TransactionStatusBadge } from "@/features/transactions/components/txn-status-badge";
import type { Transaction } from "@/types/transaction";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sample: Transaction = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  event_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  cost_item_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  work_order_id: null,
  client_invoice_id: null,
  reverses_transaction_id: null,
  transaction_type: "Internal Expense",
  payment_method: "Cash",
  amount: "250.00",
  transaction_date: "2026-07-01",
  reference_number: "REF-1",
  status: "Pending",
  remarks: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

describe("transactions feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<TransactionsEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add transaction/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a transaction row and status badge", () => {
    render(
      <TransactionTable
        transactions={[sample]}
        eventNames={{ [sample.event_id]: "Gala" }}
        costItemTitles={{ [sample.cost_item_id!]: "Meals" }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("Internal Expense")).toBeInTheDocument();
    expect(screen.getByText("Gala")).toBeInTheDocument();
    render(<TransactionStatusBadge status="Completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows shared allocation toggle on create form", async () => {
    renderWithClient(<TransactionFormDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/Split across Cost Items/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("Cost Allocations")).toBeInTheDocument();
  });
});

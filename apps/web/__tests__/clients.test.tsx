import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientFormDialog } from "@/features/clients/components/client-form-dialog";
import { ClientTable } from "@/features/clients/components/client-table";
import { ClientsEmptyState } from "@/features/clients/components/clients-empty-state";
import type { Client } from "@/types/client";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleClient: Client = {
  id: "11111111-1111-1111-1111-111111111111",
  company_name: "Acme Events",
  gst_number: null,
  phone: "123456",
  email: "a@acme.com",
  billing_address: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("clients feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<ClientsEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add client/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a client row", () => {
    render(<ClientTable clients={[sampleClient]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Acme Events")).toBeInTheDocument();
    expect(screen.getByText("a@acme.com")).toBeInTheDocument();
  });

  it("shows a validation error when company name is empty", async () => {
    renderWithClient(<ClientFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create client/i }));
    expect(await screen.findByText("Company name is required")).toBeInTheDocument();
  });
});

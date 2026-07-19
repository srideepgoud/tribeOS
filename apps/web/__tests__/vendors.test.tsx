import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { VendorFormDialog } from "@/features/vendors/components/vendor-form-dialog";
import { VendorTable } from "@/features/vendors/components/vendor-table";
import { VendorsEmptyState } from "@/features/vendors/components/vendors-empty-state";
import type { Vendor } from "@/types/vendor";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleVendor: Vendor = {
  id: "22222222-2222-2222-2222-222222222222",
  company_name: "Audio Pro",
  contact_name: "Ravi",
  phone: "123456",
  email: "a@audio.com",
  gst_number: null,
  pan_number: null,
  bank_name: null,
  account_number: null,
  ifsc: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("vendors feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<VendorsEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add vendor/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a vendor row", () => {
    render(<VendorTable vendors={[sampleVendor]} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("Audio Pro")).toBeInTheDocument();
    expect(screen.getByText("a@audio.com")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
  });

  it("shows a validation error when company name is empty", async () => {
    renderWithClient(<VendorFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create vendor/i }));
    expect(await screen.findByText("Company name is required")).toBeInTheDocument();
  });
});

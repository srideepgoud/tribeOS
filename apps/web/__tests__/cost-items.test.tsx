import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CostItemFormDialog } from "@/features/cost-items/components/cost-item-form-dialog";
import { CostItemTable } from "@/features/cost-items/components/cost-item-table";
import { CostItemsEmptyState } from "@/features/cost-items/components/cost-items-empty-state";
import { costItemFormSchema } from "@/features/cost-items/schema";
import type { CostItem } from "@/types/cost-item";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

vi.mock("@/features/events/hooks", () => ({
  useEvents: () => ({
    data: {
      data: [{ id: "33333333-3333-3333-3333-333333333333", name: "Annual Gala" }],
      meta: { pagination: { page: 1, page_size: 100, total_items: 1, total_pages: 1 } },
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/features/cost-categories/hooks", () => ({
  useCostCategories: () => ({
    data: {
      data: [
        {
          id: "44444444-4444-4444-4444-444444444444",
          event_id: "33333333-3333-3333-3333-333333333333",
          name: "Venue",
          display_order: 1,
        },
      ],
      meta: { pagination: { page: 1, page_size: 100, total_items: 1, total_pages: 1 } },
    },
    isLoading: false,
    isError: false,
  }),
}));

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleItem: CostItem = {
  id: "11111111-1111-1111-1111-111111111111",
  event_id: "33333333-3333-3333-3333-333333333333",
  category_id: "44444444-4444-4444-4444-444444444444",
  title: "Ballroom",
  description: null,
  expense_type: "Vendor",
  budget_amount: "100000.00",
  negotiated_amount: null,
  actual_amount: null,
  vendor_required: true,
  status: "Planned",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("cost items feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<CostItemsEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add cost item/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a cost item row", () => {
    render(
      <CostItemTable
        items={[sampleItem]}
        eventNames={{ [sampleItem.event_id]: "Annual Gala" }}
        categoryNames={{ [sampleItem.category_id]: "Venue" }}
        onEdit={() => {}}
        onArchive={() => {}}
      />,
    );
    expect(screen.getByText("Ballroom")).toBeInTheDocument();
    expect(screen.getByText("Venue")).toBeInTheDocument();
    expect(screen.getByText("100000.00")).toBeInTheDocument();
  });

  it("shows a validation error when title is empty", async () => {
    renderWithClient(<CostItemFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create cost item/i }));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });

  it("rejects empty title in the Zod schema", () => {
    const result = costItemFormSchema.safeParse({
      event_id: "33333333-3333-3333-3333-333333333333",
      category_id: "44444444-4444-4444-4444-444444444444",
      title: "",
      description: "",
      expense_type: "Vendor",
      budget_amount: "100",
      negotiated_amount: "",
      vendor_required: false,
      notes: "",
    });
    expect(result.success).toBe(false);
  });
});

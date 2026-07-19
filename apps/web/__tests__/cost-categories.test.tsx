import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CostCategoriesEmptyState } from "@/features/cost-categories/components/cost-categories-empty-state";
import { CostCategoryFormDialog } from "@/features/cost-categories/components/cost-category-form-dialog";
import { CostCategoryTable } from "@/features/cost-categories/components/cost-category-table";
import type { CostCategory } from "@/types/cost-category";

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

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleCategory: CostCategory = {
  id: "11111111-1111-1111-1111-111111111111",
  event_id: "33333333-3333-3333-3333-333333333333",
  name: "Venue",
  display_order: 1,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("cost categories feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<CostCategoriesEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a category row with event name", () => {
    render(
      <CostCategoryTable
        categories={[sampleCategory]}
        eventNames={{ [sampleCategory.event_id]: "Annual Gala" }}
        onEdit={() => {}}
        onArchive={() => {}}
      />,
    );
    expect(screen.getByText("Venue")).toBeInTheDocument();
    expect(screen.getByText("Annual Gala")).toBeInTheDocument();
  });

  it("shows a validation error when category name is empty", async () => {
    renderWithClient(<CostCategoryFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create category/i }));
    expect(await screen.findByText("Category name is required")).toBeInTheDocument();
  });
});

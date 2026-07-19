import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventFormDialog } from "@/features/events/components/event-form-dialog";
import { EventTable } from "@/features/events/components/event-table";
import { EventsEmptyState } from "@/features/events/components/events-empty-state";
import type { Event } from "@/types/event";

vi.mock("@/features/clients/hooks", () => ({
  useClients: () => ({
    data: {
      data: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          company_name: "Acme Events",
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

const sampleEvent: Event = {
  id: "11111111-1111-1111-1111-111111111111",
  client_id: "22222222-2222-2222-2222-222222222222",
  name: "Annual Gala",
  venue: "Grand Hyatt",
  city: "Hyderabad",
  start_datetime: "2026-06-01T10:00:00Z",
  end_datetime: "2026-06-01T22:00:00Z",
  expected_revenue: "50000.00",
  status: "Draft",
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("events feature", () => {
  it("empty state triggers the create handler", () => {
    const onCreate = vi.fn();
    render(<EventsEmptyState onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders an event row with client name", () => {
    render(
      <EventTable
        events={[sampleEvent]}
        clientNames={{ [sampleEvent.client_id]: "Acme Events" }}
        onEdit={() => {}}
        onArchive={() => {}}
      />,
    );
    expect(screen.getByText("Annual Gala")).toBeInTheDocument();
    expect(screen.getByText("Acme Events")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows a validation error when event name is empty", async () => {
    renderWithClient(<EventFormDialog open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /create event/i }));
    expect(await screen.findByText("Event name is required")).toBeInTheDocument();
  });
});

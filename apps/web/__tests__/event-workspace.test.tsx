import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NextActionBanner } from "@/features/event-workspace/components/overview/next-action-banner";
import { ReadinessBoard } from "@/features/event-workspace/components/overview/readiness-board";
import type { ReadinessIndicator } from "@/features/event-workspace/hooks";

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const indicators: ReadinessIndicator[] = [
  {
    id: "budget",
    label: "Budget Complete",
    status: "attention",
    detail: "Add budget sections and lines",
    href: "/events/1/budget",
  },
  {
    id: "commercial",
    label: "Commercial Complete",
    status: "done",
    detail: "Event is in Procurement",
    href: "/events/1/budget",
  },
];

describe("event workspace", () => {
  it("renders the next action banner", () => {
    renderWithClient(
      <NextActionBanner
        action={{
          label: "Build your budget",
          description: "Add budget sections and lines for this event.",
          href: "/events/1/budget",
        }}
      />,
    );
    expect(screen.getByText("Next action")).toBeInTheDocument();
    expect(screen.getByText("Build your budget")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go/i })).toHaveAttribute("href", "/events/1/budget");
  });

  it("renders readiness indicators", () => {
    renderWithClient(<ReadinessBoard indicators={indicators} profitForecast="12500.00" />);
    expect(screen.getByText("Budget Complete")).toBeInTheDocument();
    expect(screen.getByText("Commercial Complete")).toBeInTheDocument();
    expect(screen.getByText("Attention")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

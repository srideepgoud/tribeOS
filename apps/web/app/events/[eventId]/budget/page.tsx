import type { Metadata } from "next";

import { BudgetTab } from "@/features/event-workspace/components/budget/budget-tab";

export const metadata: Metadata = {
  title: "Event Budget · TribeOS",
};

interface BudgetPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventBudgetPage({ params }: BudgetPageProps) {
  const { eventId } = await params;
  return <BudgetTab eventId={eventId} />;
}

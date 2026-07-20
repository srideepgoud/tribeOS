import type { Metadata } from "next";

import { ExpensesTab } from "@/features/event-workspace/components/expenses/expenses-tab";

export const metadata: Metadata = {
  title: "Event Expenses · TribeOS",
};

interface ExpensesPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventExpensesPage({ params }: ExpensesPageProps) {
  const { eventId } = await params;
  return <ExpensesTab eventId={eventId} />;
}

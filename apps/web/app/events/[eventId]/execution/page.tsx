import type { Metadata } from "next";

import { ExecutionTab } from "@/features/event-workspace/components/execution/execution-tab";

export const metadata: Metadata = {
  title: "Event Execution · TribeOS",
};

interface ExecutionPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventExecutionPage({ params }: ExecutionPageProps) {
  const { eventId } = await params;
  return <ExecutionTab eventId={eventId} />;
}

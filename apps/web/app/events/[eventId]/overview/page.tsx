import type { Metadata } from "next";

import { OverviewTab } from "@/features/event-workspace/components/overview/overview-tab";

export const metadata: Metadata = {
  title: "Event Overview · TribeOS",
};

interface OverviewPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventOverviewPage({ params }: OverviewPageProps) {
  const { eventId } = await params;
  return <OverviewTab eventId={eventId} />;
}

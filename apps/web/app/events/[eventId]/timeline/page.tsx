import type { Metadata } from "next";

import { TimelineTab } from "@/features/event-workspace/components/timeline/timeline-tab";

export const metadata: Metadata = {
  title: "Event Timeline · TribeOS",
};

interface TimelinePageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventTimelinePage({ params }: TimelinePageProps) {
  const { eventId } = await params;
  return <TimelineTab eventId={eventId} />;
}

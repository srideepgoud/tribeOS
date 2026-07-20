import type { Metadata } from "next";

import { SettlementTab } from "@/features/event-workspace/components/settlement/settlement-tab";

export const metadata: Metadata = {
  title: "Event Settlement · TribeOS",
};

interface SettlementPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventSettlementPage({ params }: SettlementPageProps) {
  const { eventId } = await params;
  return <SettlementTab eventId={eventId} />;
}

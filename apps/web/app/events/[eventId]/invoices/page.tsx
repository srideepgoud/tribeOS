import type { Metadata } from "next";

import { InvoicesTab } from "@/features/event-workspace/components/invoices/invoices-tab";

export const metadata: Metadata = {
  title: "Event Invoices · TribeOS",
};

interface InvoicesPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventInvoicesPage({ params }: InvoicesPageProps) {
  const { eventId } = await params;
  return <InvoicesTab eventId={eventId} />;
}

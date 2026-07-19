import type { Metadata } from "next";

import { EventsView } from "@/features/events/components/events-view";

export const metadata: Metadata = {
  title: "Events · TribeOS",
};

export default function EventsPage() {
  return <EventsView />;
}

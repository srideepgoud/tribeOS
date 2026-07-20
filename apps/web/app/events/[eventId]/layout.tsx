import type { ReactNode } from "react";

import { EventWorkspaceLayoutClient } from "@/features/event-workspace/components/event-workspace-layout-client";

interface EventWorkspaceLayoutProps {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}

export default async function EventWorkspaceLayout({
  children,
  params,
}: EventWorkspaceLayoutProps) {
  const { eventId } = await params;
  return <EventWorkspaceLayoutClient eventId={eventId}>{children}</EventWorkspaceLayoutClient>;
}

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import {
  EventWorkspaceShell,
  resolveActiveTab,
} from "./event-workspace-shell";

interface EventWorkspaceLayoutClientProps {
  eventId: string;
  children: ReactNode;
}

export function EventWorkspaceLayoutClient({
  eventId,
  children,
}: EventWorkspaceLayoutClientProps) {
  const pathname = usePathname();
  const segment = pathname.split("/").pop() ?? "overview";
  const activeTab = resolveActiveTab(segment);

  return (
    <EventWorkspaceShell eventId={eventId} activeTab={activeTab}>
      {children}
    </EventWorkspaceShell>
  );
}

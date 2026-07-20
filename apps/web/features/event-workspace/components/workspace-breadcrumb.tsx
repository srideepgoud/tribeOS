"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { WorkspaceTab } from "../constants";

interface WorkspaceBreadcrumbProps {
  eventName: string;
  eventId: string;
  activeTab: WorkspaceTab;
}

export function WorkspaceBreadcrumb({ eventName, eventId, activeTab }: WorkspaceBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link href="/events" className="transition-colors hover:text-foreground">
        Events
      </Link>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
      <Link
        href={`/events/${eventId}/overview`}
        className="transition-colors hover:text-foreground"
      >
        {eventName}
      </Link>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
      <span className="font-medium text-foreground">{activeTab.label}</span>
    </nav>
  );
}

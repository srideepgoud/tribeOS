"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@tribeos/ui";

import type { EventStatus } from "@/types/event";

import { WORKSPACE_TABS, isTabAvailable, workspaceTabHref } from "../constants";

interface EventWorkspaceTabsProps {
  eventId: string;
  eventStatus: EventStatus;
}

export function EventWorkspaceTabs({ eventId, eventStatus }: EventWorkspaceTabsProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Event workspace" className="border-b border-border">
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {WORKSPACE_TABS.map((tab) => {
          const href = workspaceTabHref(eventId, tab);
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const available = isTabAvailable(eventStatus, tab);

          if (!available) {
            return (
              <span
                key={tab.id}
                title={tab.unavailableHint}
                className="shrink-0 cursor-not-allowed border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-disabled"
                aria-disabled="true"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link
              key={tab.id}
              href={href}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:border-border hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

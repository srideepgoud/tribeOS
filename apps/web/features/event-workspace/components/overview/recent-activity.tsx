"use client";

import Link from "next/link";

import { useTimelineData } from "../../hooks/use-timeline-data";
import { formatTimelineTimestamp } from "../../lib/timeline-utils";

interface RecentActivityProps {
  eventId: string;
}

export function RecentActivity({ eventId }: RecentActivityProps) {
  const { entries, isLoading } = useTimelineData(eventId);
  const recent = entries.slice(0, 5);

  if (isLoading) {
    return <p className="text-sm text-muted">Loading recent activity…</p>;
  }

  if (recent.length === 0) {
    return (
      <p className="text-sm text-muted">
        No activity yet. Actions across Budget, Execution, Expenses, and Invoices will appear here.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {recent.map((entry) => (
        <li key={entry.id}>
          <Link
            href={entry.href}
            className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/20"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{entry.title}</span>
              <time className="text-xs text-muted" dateTime={entry.timestamp}>
                {formatTimelineTimestamp(entry.timestamp)}
              </time>
            </div>
            <span className="text-sm text-foreground-secondary">{entry.description}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

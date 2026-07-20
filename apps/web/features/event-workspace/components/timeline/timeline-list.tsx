"use client";

import Link from "next/link";

import type { TimelineEntry } from "../../lib/timeline-utils";
import { formatTimelineTimestamp } from "../../lib/timeline-utils";

const ENTITY_LABELS: Record<TimelineEntry["entityType"], string> = {
  event: "Event",
  budget_section: "Budget section",
  budget_line: "Budget line",
  work_order: "Work order",
  expense: "Expense",
  invoice: "Invoice",
  receipt: "Receipt",
};

interface TimelineListProps {
  entries: readonly TimelineEntry[];
}

export function TimelineList({ entries }: TimelineListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">No activity yet</p>
        <p className="mt-2 text-sm text-muted">
          Activity will appear here as you build the budget, assign vendors, and record finances.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative flex flex-col gap-0 border-l border-border pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative pb-6 last:pb-0">
          <span
            aria-hidden
            className="absolute -left-[1.6rem] top-1.5 size-2.5 rounded-full border border-border bg-background"
          />
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{entry.title}</p>
              <time className="text-xs text-muted" dateTime={entry.timestamp}>
                {formatTimelineTimestamp(entry.timestamp)}
              </time>
            </div>
            <p className="text-sm text-foreground-secondary">{entry.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted">
                {ENTITY_LABELS[entry.entityType]}
              </span>
              <Link href={entry.href} className="text-xs font-medium text-primary hover:underline">
                Open
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

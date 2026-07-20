"use client";

import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";

import { useTimelineData } from "../../hooks/use-timeline-data";
import {
  filterTimelineEntries,
  type TimelineFilter,
} from "../../lib/timeline-utils";
import { WorkspaceErrorState } from "../workspace-error-state";
import { TimelineList } from "./timeline-list";

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "budget", label: "Budget" },
  { value: "execution", label: "Execution" },
  { value: "expenses", label: "Expenses" },
  { value: "invoices", label: "Invoices" },
];

interface TimelineTabProps {
  eventId: string;
}

export function TimelineTab({ eventId }: TimelineTabProps) {
  const { entries, isLoading, isError, error, refetch } = useTimelineData(eventId);
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const filtered = useMemo(
    () => filterTimelineEntries(entries, filter),
    [entries, filter],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load event timeline.")}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
          <p className="text-sm text-muted">
            Chronological activity for this event, synthesized from event records until Audit Log
            entries are available.
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as TimelineFilter)}>
          <SelectTrigger className="w-[180px]" aria-label="Filter timeline">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <TimelineList entries={filtered} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { Skeleton } from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";

import { useEventOverview } from "../../hooks";
import { WorkspaceErrorState } from "../workspace-error-state";
import { NextActionBanner } from "./next-action-banner";
import { ReadinessBoard } from "./readiness-board";
import { RecentActivity } from "./recent-activity";

interface OverviewTabProps {
  eventId: string;
}

export function OverviewTab({ eventId }: OverviewTabProps) {
  const { overview, isLoading, isError, error, refetch } = useEventOverview(eventId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load event overview.")}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <NextActionBanner action={overview.nextAction} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Can I run this event?</h2>
          <p className="text-sm text-muted">
            Readiness indicators for budget, execution, collections, and settlement.
          </p>
        </div>
        <ReadinessBoard
          indicators={overview.indicators}
          profitForecast={overview.profitForecast}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium text-foreground">Recent activity</h2>
          <p className="text-sm text-muted">
            Full event history is available on the{" "}
            <Link href={`/events/${eventId}/timeline`} className="text-primary hover:underline">
              Timeline
            </Link>{" "}
            tab.
          </p>
        </div>
        <RecentActivity eventId={eventId} />
      </section>
    </div>
  );
}

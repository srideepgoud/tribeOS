"use client";

import { useState } from "react";
import { Button, Skeleton } from "@tribeos/ui";

import { useUpdateEvent } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import { statusRank } from "@/features/event-workspace/constants";

import { useSettlementData } from "../../hooks/use-settlement-data";
import { isBudgetFrozen } from "../../lib/settlement-utils";
import { WorkspaceErrorState } from "../workspace-error-state";
import { SettlementGates } from "./settlement-gates";
import { SettlementPnlPanel } from "./settlement-pnl-panel";

interface SettlementTabProps {
  eventId: string;
}

export function SettlementTab({ eventId }: SettlementTabProps) {
  const {
    event,
    summary,
    readiness,
    readinessLoading,
    readinessError,
    pnl,
    isLoading,
    isError,
    error,
    refetch,
  } = useSettlementData(eventId);
  const updateEvent = useUpdateEvent();
  const [closeError, setCloseError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load settlement data.")}
        onRetry={refetch}
      />
    );
  }

  const inSettlement = event.status === "Settlement";
  const isClosed = event.status === "Closed";
  const beforeSettlement = statusRank(event.status) < statusRank("Settlement");
  const canClose = inSettlement && readiness?.ready === true;
  const budgetFrozen = isBudgetFrozen(event.status);

  const handleClose = async () => {
    setCloseError(null);
    try {
      await updateEvent.mutateAsync({ id: eventId, input: { status: "Closed" } });
    } catch (err) {
      setCloseError(apiErrorMessage(err, "Could not close this event."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Settlement</h2>
        <p className="text-sm text-muted">
          Reconcile the event, verify close gates, and complete financial close.
        </p>
      </header>

      {beforeSettlement ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-sm text-foreground-secondary">
          Settlement unlocks after the event advances to the Settlement phase. Complete execution,
          collections, and expense attribution first.
        </div>
      ) : null}

      {isClosed ? (
        <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-foreground">
          This event is closed. Financial records remain read-only.
        </div>
      ) : null}

      {budgetFrozen ? (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted">
          Budget is frozen during Settlement and after Close.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {inSettlement || isClosed ? (
          <SettlementGates
            eventId={eventId}
            readiness={readiness}
            isLoading={readinessLoading}
            errorMessage={
              readinessError ? apiErrorMessage(readinessError, "Could not load readiness.") : null
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted">
            Close gates become active when the event enters Settlement.
          </div>
        )}

        {pnl && summary ? <SettlementPnlPanel pnl={pnl} /> : null}
      </div>

      {inSettlement ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-foreground">Close event</h3>
            <p className="text-sm text-muted">
              Close Event is enabled only when all settlement checks pass.
            </p>
          </div>
          {closeError ? (
            <p className="text-sm text-danger" role="alert">
              {closeError}
            </p>
          ) : null}
          <Button
            className="w-fit"
            disabled={!canClose || updateEvent.isPending}
            onClick={() => void handleClose()}
          >
            Close event
          </Button>
        </div>
      ) : null}
    </div>
  );
}

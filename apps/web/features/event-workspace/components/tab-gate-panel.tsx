"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants, cn } from "@tribeos/ui";

import { useUpdateEvent } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { Event } from "@/types/event";

import {
  nextLifecycleStatus,
  workspaceTabHref,
  type WorkspaceTab,
  WORKSPACE_TABS,
} from "../constants";

interface TabGatePanelProps {
  event: Event;
  tab: WorkspaceTab;
}

export function TabGatePanel({ event, tab }: TabGatePanelProps) {
  const updateEvent = useUpdateEvent();
  const nextStatus = nextLifecycleStatus(event.status);
  const primaryTab = WORKSPACE_TABS.find((item) => item.segment === tab.gatePrimaryHref);

  const advance = async () => {
    if (!nextStatus || nextStatus === "Closed") return;
    await updateEvent.mutateAsync({ id: event.id, input: { status: nextStatus } });
  };

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-dashed border-border bg-surface px-6 py-12">
      <div className="flex max-w-xl flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Current status: {event.status} · Needs {tab.availableFrom}+
        </p>
        <h2 className="text-xl font-semibold text-foreground">{tab.gateTitle}</h2>
        <p className="text-sm text-muted">{tab.gateBody}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {primaryTab ? (
          <Link
            href={workspaceTabHref(event.id, primaryTab)}
            className={cn(buttonVariants({ variant: "secondary" }), "inline-flex items-center gap-2")}
          >
            {tab.gatePrimaryLabel ?? primaryTab.label}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}

        {nextStatus && nextStatus !== "Closed" ? (
          <Button disabled={updateEvent.isPending} onClick={() => void advance()}>
            Advance to {nextStatus}
          </Button>
        ) : null}
      </div>

      {updateEvent.error ? (
        <p className="text-sm text-danger" role="alert">
          {apiErrorMessage(updateEvent.error)}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { CalendarPlus } from "lucide-react";
import { Button } from "@tribeos/ui";

export function EventsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-hover text-muted">
        <CalendarPlus className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground">No events yet</h3>
        <p className="max-w-sm text-sm text-muted">
          Create your first event and associate it with a client to begin planning.
        </p>
      </div>
      <Button onClick={onCreate}>
        <CalendarPlus />
        Add event
      </Button>
    </div>
  );
}

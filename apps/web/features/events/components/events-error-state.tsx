"use client";

import { Button } from "@tribeos/ui";

interface EventsErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function EventsErrorState({ message, onRetry }: EventsErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">Could not load events</h3>
      <p className="max-w-sm text-sm text-muted">
        {message ?? "Something went wrong while loading events."}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

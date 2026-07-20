"use client";

import { Button } from "@tribeos/ui";

interface DashboardErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function DashboardErrorState({ message, onRetry }: DashboardErrorStateProps) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-border bg-background-secondary p-6"
      role="alert"
    >
      <h2 className="text-lg font-semibold text-foreground">Could not load dashboard</h2>
      <p className="text-sm text-muted">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

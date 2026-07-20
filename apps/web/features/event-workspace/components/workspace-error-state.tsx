"use client";

import { Button } from "@tribeos/ui";

interface WorkspaceErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function WorkspaceErrorState({ message, onRetry }: WorkspaceErrorStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center"
      role="alert"
    >
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

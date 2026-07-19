"use client";

import { Button } from "@tribeos/ui";

interface CostCategoriesErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function CostCategoriesErrorState({ message, onRetry }: CostCategoriesErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">Could not load cost categories</h3>
      <p className="max-w-sm text-sm text-muted">
        {message ?? "Something went wrong while loading cost categories."}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

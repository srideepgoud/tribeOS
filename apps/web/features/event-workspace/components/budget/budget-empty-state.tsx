interface BudgetEmptyStateProps {
  message: string;
}

export function BudgetEmptyState({ message }: BudgetEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-lg font-semibold text-foreground">Build your event budget</h2>
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  );
}

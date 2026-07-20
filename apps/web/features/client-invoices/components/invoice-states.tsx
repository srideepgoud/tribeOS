import { Button } from "@tribeos/ui";

export function ClientInvoicesEmptyState({
  onCreate,
  hasFilters,
}: {
  onCreate: () => void;
  hasFilters?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-16 text-center">
      <p className="text-base font-medium text-foreground">
        {hasFilters ? "No invoices match your filters" : "No client invoices yet"}
      </p>
      <p className="max-w-sm text-sm text-muted">
        Client Invoices record what the client owes. Receipts are recorded as Transactions.
      </p>
      {!hasFilters ? (
        <Button onClick={onCreate}>Add invoice</Button>
      ) : null}
    </div>
  );
}

export function ClientInvoicesErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function ClientInvoicesLoading() {
  return <div className="h-40 animate-pulse rounded-md bg-muted/50" aria-busy="true" />;
}

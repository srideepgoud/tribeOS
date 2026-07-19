"use client";

import { Banknote, Plus } from "lucide-react";
import { Button } from "@tribeos/ui";

export function TransactionsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-hover text-muted">
        <Banknote className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground">No transactions yet</h3>
        <p className="max-w-sm text-sm text-muted">
          Record Vendor Payments and Internal Expenses against Cost Items.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus />
        Add transaction
      </Button>
    </div>
  );
}

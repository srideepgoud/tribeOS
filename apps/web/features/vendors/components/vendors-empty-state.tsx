"use client";

import { Plus, Store } from "lucide-react";
import { Button } from "@tribeos/ui";

export function VendorsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-surface p-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-hover text-muted">
        <Store className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-foreground">No vendors yet</h3>
        <p className="max-w-sm text-sm text-muted">
          Add your first vendor to track suppliers and service providers.
        </p>
      </div>
      <Button onClick={onCreate}>
        <Plus />
        Add vendor
      </Button>
    </div>
  );
}

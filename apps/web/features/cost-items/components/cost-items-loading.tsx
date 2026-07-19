import { Skeleton } from "@tribeos/ui";

const ROWS = ["r1", "r2", "r3", "r4", "r5", "r6"];

export function CostItemsLoading() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      {ROWS.map((row) => (
        <div key={row} className="flex items-center gap-4">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="h-5 w-1/6" />
          <Skeleton className="ml-auto h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

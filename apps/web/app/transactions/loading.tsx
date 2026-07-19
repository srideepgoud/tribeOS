import { Skeleton } from "@tribeos/ui";

import { TransactionsLoading } from "@/features/transactions/components/txn-loading";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <TransactionsLoading />
    </div>
  );
}

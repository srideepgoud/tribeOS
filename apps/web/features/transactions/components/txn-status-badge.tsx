"use client";

import { Badge } from "@tribeos/ui";

import type { TransactionStatus } from "@/types/transaction";

const VARIANT: Record<
  TransactionStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"
> = {
  Pending: "secondary",
  Completed: "success",
  Failed: "danger",
  Reversed: "warning",
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}

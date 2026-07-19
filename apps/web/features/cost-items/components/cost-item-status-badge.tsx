"use client";

import { Badge } from "@tribeos/ui";

import type { CostItemStatus } from "@/types/cost-item";

const VARIANT: Record<
  CostItemStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"
> = {
  Planned: "secondary",
  Approved: "info",
  "In Progress": "warning",
  Completed: "success",
  Cancelled: "danger",
};

export function CostItemStatusBadge({ status }: { status: CostItemStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}

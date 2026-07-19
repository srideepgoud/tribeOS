"use client";

import { Badge } from "@tribeos/ui";

import type { VendorWorkOrderStatus } from "@/types/vendor-work-order";

const VARIANT: Record<
  VendorWorkOrderStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"
> = {
  Draft: "secondary",
  Approved: "info",
  Issued: "warning",
  "In Progress": "warning",
  Completed: "success",
  Cancelled: "danger",
};

export function VendorWorkOrderStatusBadge({ status }: { status: VendorWorkOrderStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}

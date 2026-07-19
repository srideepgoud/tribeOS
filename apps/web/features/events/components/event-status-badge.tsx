"use client";

import { Badge } from "@tribeos/ui";

import type { EventStatus } from "@/types/event";

const VARIANT: Record<
  EventStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"
> = {
  Draft: "secondary",
  Planning: "info",
  Commercials: "info",
  Procurement: "warning",
  Execution: "warning",
  Settlement: "default",
  Closed: "success",
  Cancelled: "danger",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}

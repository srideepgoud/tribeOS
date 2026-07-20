"use client";

import { Badge } from "@tribeos/ui";

import type { ClientInvoiceStatus } from "@/types/client-invoice";

const VARIANT: Record<
  ClientInvoiceStatus,
  "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"
> = {
  Draft: "secondary",
  Issued: "info",
  "Partially Paid": "warning",
  Paid: "success",
  Cancelled: "danger",
};

export function ClientInvoiceStatusBadge({ status }: { status: ClientInvoiceStatus }) {
  return <Badge variant={VARIANT[status]}>{status}</Badge>;
}

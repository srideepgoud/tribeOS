"use client";

import { Pencil, Plus } from "lucide-react";
import { Badge, Button } from "@tribeos/ui";

import { VendorWorkOrderStatusBadge } from "@/features/vendor-work-orders/components/vwo-status-badge";
import { formatMoney } from "@/lib/money";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

import type { ExecutionLineGroup } from "../../lib/execution-utils";

interface ExecutionLineCardProps {
  lineGroup: ExecutionLineGroup;
  vendorNames: Readonly<Record<string, string>>;
  canAssign: boolean;
  onAssign: (costItemId: string) => void;
  onEditWorkOrder: (workOrder: VendorWorkOrder) => void;
}

export function ExecutionLineCard({
  lineGroup,
  vendorNames,
  canAssign,
  onAssign,
  onEditWorkOrder,
}: ExecutionLineCardProps) {
  const { line, workOrders, committed, planned, covered } = lineGroup;

  return (
    <article className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-foreground">{line.title}</h4>
            {covered ? (
              <Badge variant="success">Covered</Badge>
            ) : (
              <Badge variant="warning">No vendor assigned</Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            Planned {formatMoney(planned.toFixed(2))} · Committed{" "}
            {formatMoney(committed.toFixed(2))}
          </p>
        </div>
        {canAssign ? (
          <Button size="sm" variant="secondary" onClick={() => onAssign(line.id)}>
            <Plus />
            Assign vendor
          </Button>
        ) : null}
      </div>

      {workOrders.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">No work orders on this line yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {workOrders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {vendorNames[order.vendor_id] ?? "Vendor"}
                </p>
                <p className="text-xs text-muted">{order.work_order_number}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm tabular-nums text-foreground-secondary">
                  {formatMoney(order.agreed_amount)}
                </span>
                <VendorWorkOrderStatusBadge status={order.status} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${order.work_order_number}`}
                  onClick={() => onEditWorkOrder(order)}
                >
                  <Pencil />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

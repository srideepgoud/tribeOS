"use client";

import { Pencil } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { VendorWorkOrder } from "@/types/vendor-work-order";

import { VendorWorkOrderStatusBadge } from "./vwo-status-badge";

interface VendorWorkOrderTableProps {
  workOrders: VendorWorkOrder[];
  vendorNames: Record<string, string>;
  costItemTitles: Record<string, string>;
  onEdit: (workOrder: VendorWorkOrder) => void;
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function VendorWorkOrderTable({
  workOrders,
  vendorNames,
  costItemTitles,
  onEdit,
}: VendorWorkOrderTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Cost Item</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((workOrder) => (
            <TableRow key={workOrder.id}>
              <TableCell className="font-medium text-foreground">
                {workOrder.work_order_number}
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {vendorNames[workOrder.vendor_id] ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {costItemTitles[workOrder.cost_item_id] ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {formatMoney(workOrder.agreed_amount)}
              </TableCell>
              <TableCell>
                <VendorWorkOrderStatusBadge status={workOrder.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${workOrder.work_order_number}`}
                  onClick={() => onEdit(workOrder)}
                >
                  <Pencil />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

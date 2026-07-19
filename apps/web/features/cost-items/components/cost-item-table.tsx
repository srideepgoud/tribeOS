"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { CostItem } from "@/types/cost-item";

import { CostItemStatusBadge } from "./cost-item-status-badge";

interface CostItemTableProps {
  items: CostItem[];
  eventNames: Record<string, string>;
  categoryNames: Record<string, string>;
  onEdit: (item: CostItem) => void;
  onArchive: (item: CostItem) => void;
}

export function CostItemTable({
  items,
  eventNames,
  categoryNames,
  onEdit,
  onArchive,
}: CostItemTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-foreground">{item.title}</TableCell>
              <TableCell className="text-foreground-secondary">
                {eventNames[item.event_id] ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {categoryNames[item.category_id] ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">{item.expense_type}</TableCell>
              <TableCell className="tabular-nums text-foreground-secondary">
                {item.budget_amount}
              </TableCell>
              <TableCell>
                <CostItemStatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${item.title}`}
                    onClick={() => onEdit(item)}
                  >
                    <Pencil />
                  </Button>
                  {item.status !== "Completed" && item.status !== "Cancelled" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Archive ${item.title}`}
                      onClick={() => onArchive(item)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

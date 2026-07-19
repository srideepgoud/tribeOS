"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { CostCategory } from "@/types/cost-category";

interface CostCategoryTableProps {
  categories: CostCategory[];
  eventNames: Record<string, string>;
  onEdit: (category: CostCategory) => void;
  onArchive: (category: CostCategory) => void;
}

export function CostCategoryTable({
  categories,
  eventNames,
  onEdit,
  onArchive,
}: CostCategoryTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="text-muted tabular-nums">{category.display_order}</TableCell>
              <TableCell className="font-medium text-foreground">{category.name}</TableCell>
              <TableCell className="text-foreground-secondary">
                {eventNames[category.event_id] ?? "—"}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => onEdit(category)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Archive ${category.name}`}
                    onClick={() => onArchive(category)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Textarea } from "@tribeos/ui";

import { useCreateCostCategory } from "@/features/cost-categories/hooks";
import { useCreateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { nextSectionDisplayOrder } from "../../lib/budget-utils";
import { parseBudgetBulkPaste } from "../../lib/bulk-paste-utils";

interface BudgetBulkPasteDialogProps {
  eventId: string;
  categories: readonly CostCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetBulkPasteDialog({
  eventId,
  categories,
  open,
  onOpenChange,
}: BudgetBulkPasteDialogProps) {
  const createCategory = useCreateCostCategory();
  const createItem = useCreateCostItem();
  const [text, setText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsed = useMemo(() => parseBudgetBulkPaste(text), [text]);
  const totalLines = parsed.sections.reduce((sum, section) => sum + section.lines.length, 0);
  const canImport = parsed.sections.length > 0 && parsed.errors.length === 0 && !createItem.isPending;

  const onImport = async () => {
    if (!canImport) return;
    setSubmitError(null);
    try {
      const categoryByName = new Map<string, CostCategory>(
        categories
          .filter((row) => !row.archived_at)
          .map((row) => [row.name.trim().toLowerCase(), row] as const),
      );
      let displayOrder = nextSectionDisplayOrder(categories);

      for (const section of parsed.sections) {
        const normalized = section.name.trim().toLowerCase();
        let categoryId = categoryByName.get(normalized)?.id;
        if (!categoryId) {
          const created = await createCategory.mutateAsync({
            event_id: eventId,
            name: section.name,
            display_order: displayOrder,
          });
          categoryId = created.id;
          categoryByName.set(normalized, created);
          displayOrder += 1;
        }

        for (const line of section.lines) {
          await createItem.mutateAsync({
            event_id: eventId,
            category_id: categoryId,
            title: line.title,
            expense_type: "Vendor",
            budget_amount: line.budgetAmount,
            vendor_required: true,
          });
        }
      }

      setText("");
      onOpenChange(false);
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "Could not import pasted budget lines."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk paste budget rows</DialogTitle>
          <DialogDescription>
            Paste rows from Excel/Sheets in this format: Section, Budget Line, Planned Amount.
            Use tab-separated columns; blank section cells reuse the last section.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Textarea
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Production\tStage Build\t120000\n\tSound Rental\t45000\nF&B\tCatering\t90000"}
            aria-label="Paste budget rows"
          />

          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted">
            {parsed.rowCount} row(s) parsed • {parsed.sections.length} section(s) • {totalLines} line(s)
          </div>

          {parsed.errors.length > 0 ? (
            <div className="max-h-28 overflow-auto rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
              {parsed.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {submitError ? (
            <p className="text-sm text-danger" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canImport} onClick={() => void onImport()}>
            Import {totalLines > 0 ? `${totalLines} line${totalLines === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

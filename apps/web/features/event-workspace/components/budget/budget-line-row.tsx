"use client";

import { useState } from "react";
import {
  Lock,
  MoreHorizontal,
  PanelRightOpen,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { Button } from "@tribeos/ui";

import { ArchiveCostItemDialog } from "@/features/cost-items/components/archive-cost-item-dialog";
import { CostItemStatusBadge } from "@/features/cost-items/components/cost-item-status-badge";
import { useUpdateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostItem } from "@/types/cost-item";
import { isBudgetFrozen, isCostItemReadOnly } from "@/types/cost-item";

import { computeLineTotals, parseBudgetAmount } from "../../lib/budget-utils";
import { BudgetAmountCell } from "./budget-columns";
import { InlineBudgetInput } from "./inline-budget-input";

interface BudgetLineRowProps {
  line: CostItem;
  eventId: string;
  committedByLineId: Readonly<Record<string, number>>;
  editable: boolean;
  selected: boolean;
  onOpen: () => void;
  onAssignVendor: () => void;
  onRecordExpense: () => void;
}

export function BudgetLineRow({
  line,
  committedByLineId,
  editable,
  selected,
  onOpen,
  onAssignVendor,
  onRecordExpense,
}: BudgetLineRowProps) {
  const updateItem = useUpdateCostItem();
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = isCostItemReadOnly(line.status);
  const budgetLocked = isBudgetFrozen(line.status);
  const canEdit = editable && !readOnly;
  const canEditBudget = canEdit && !budgetLocked;
  const totals = computeLineTotals(line, committedByLineId);
  const canAssignVendor = line.expense_type === "Vendor" && !readOnly;

  const saveField = async (input: { title?: string; budget_amount?: string }) => {
    setError(null);
    try {
      await updateItem.mutateAsync({ id: line.id, input });
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save budget line."));
      throw err;
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={`grid cursor-pointer grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_6rem_3rem] items-center gap-3 border-b border-border/60 px-4 py-2 transition-colors hover:bg-hover ${
          selected ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
        }`}
        title="Open budget line detail"
      >
        <div
          className="flex min-w-0 items-center gap-2 pl-6"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {budgetLocked ? <Lock className="size-3.5 shrink-0 text-muted" aria-hidden /> : null}
          {canEdit ? (
            <InlineBudgetInput
              value={line.title}
              onSave={async (title) => {
                const trimmed = title.trim();
                if (!trimmed || trimmed === line.title) return;
                await saveField({ title: trimmed });
              }}
              ariaLabel={`Budget line ${line.title}`}
              className="h-9 border-transparent bg-transparent px-2 hover:border-input focus-visible:border-input"
            />
          ) : (
            <span className="truncate text-sm text-foreground">{line.title}</span>
          )}
        </div>

        <div
          className="text-right"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {canEditBudget ? (
            <div className="relative">
              <InlineBudgetInput
                value={line.budget_amount}
                onSave={async (amount) => {
                  const parsed = parseBudgetAmount(amount);
                  if (!parsed || parsed === line.budget_amount) return;
                  await saveField({ budget_amount: parsed });
                }}
                inputMode="decimal"
                ariaLabel={`Budget amount for ${line.title}`}
                className="h-9 border border-input/60 bg-background px-2 text-right font-medium text-foreground hover:border-input focus-visible:border-primary"
              />
            </div>
          ) : (
            <BudgetAmountCell
              value={totals.planned}
              className="text-right font-medium text-foreground"
            />
          )}
        </div>

        <button
          type="button"
          className="text-right"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          title="Derived from Vendor Work Orders — open details"
        >
          <BudgetAmountCell value={totals.committed} className="text-right" derived />
        </button>
        <button
          type="button"
          className="text-right"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          title="Derived from attributed spend — open details"
        >
          <BudgetAmountCell value={totals.actual} className="text-right" derived />
        </button>
        <div className="text-right" title="Budget − Actual (calculated)">
          <BudgetAmountCell value={totals.variance} className="text-right" derived />
        </div>

        <CostItemStatusBadge status={line.status} />

        <div
          className="relative flex justify-end"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${line.title}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal />
          </Button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-md border border-border bg-card py-1 shadow-lg">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-hover"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                >
                  <PanelRightOpen className="size-4" />
                  Open details
                </button>
                {canAssignVendor ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      onAssignVendor();
                    }}
                  >
                    <Plus className="size-4" />
                    Assign vendor
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-hover"
                  onClick={() => {
                    setMenuOpen(false);
                    onRecordExpense();
                  }}
                >
                  <Receipt className="size-4" />
                  Record expense
                </button>
                {canEdit ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-hover"
                    onClick={() => {
                      setMenuOpen(false);
                      setArchiveOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Archive
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="px-10 pb-2 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <ArchiveCostItemDialog open={archiveOpen} onOpenChange={setArchiveOpen} item={line} />
    </>
  );
}

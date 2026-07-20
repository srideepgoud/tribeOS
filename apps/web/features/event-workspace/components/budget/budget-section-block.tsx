"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button, Input } from "@tribeos/ui";

import { useCreateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostItem } from "@/types/cost-item";

import type { BudgetSectionGroup } from "../../lib/budget-utils";
import { parseBudgetAmount } from "../../lib/budget-utils";
import { BudgetTotalsRow } from "./budget-columns";
import { BudgetLineRow } from "./budget-line-row";
import { InlineBudgetInput } from "./inline-budget-input";

interface AddBudgetLineRowProps {
  eventId: string;
  categoryId: string;
  editable: boolean;
}

function AddBudgetLineRow({ eventId, categoryId, editable }: AddBudgetLineRowProps) {
  const createItem = useCreateCostItem();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!editable) return null;

  const commit = async () => {
    const trimmedTitle = title.trim();
    const parsedAmount = parseBudgetAmount(amount);
    if (!trimmedTitle && !amount.trim()) return;
    if (!trimmedTitle) {
      setError("Enter a line name.");
      return;
    }
    if (!parsedAmount) {
      setError("Enter a valid planned amount.");
      return;
    }

    setError(null);
    try {
      await createItem.mutateAsync({
        event_id: eventId,
        category_id: categoryId,
        title: trimmedTitle,
        expense_type: "Vendor",
        budget_amount: parsedAmount,
        vendor_required: true,
      });
      setTitle("");
      setAmount("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create budget line."));
    }
  };

  return (
    <div className="border-b border-border/60 px-4 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 pl-6">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add budget line"
          aria-label="New budget line name"
          className="h-9"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
          }}
        />
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
          inputMode="decimal"
          aria-label="New budget line planned amount"
          className="h-9 text-right"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
          }}
          onBlur={() => void commit()}
        />
      </div>
      {error ? (
        <p className="mt-1 pl-6 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface BudgetSectionBlockProps {
  group: BudgetSectionGroup;
  eventId: string;
  committedByLineId: Readonly<Record<string, number>>;
  editable: boolean;
  selectedLineId: string | null;
  onOpenLine: (line: CostItem) => void;
  onArchiveSection: (sectionId: string) => void;
  onUpdateSectionName: (sectionId: string, name: string) => Promise<void>;
}

export function BudgetSectionBlock({
  group,
  eventId,
  committedByLineId,
  editable,
  selectedLineId,
  onOpenLine,
  onArchiveSection,
  onUpdateSectionName,
}: BudgetSectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="border-b border-border">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_6rem_3rem] items-center gap-3 bg-background-secondary/70 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={collapsed ? "Expand section" : "Collapse section"}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <ChevronRight /> : <ChevronDown />}
          </Button>
          {editable ? (
            <InlineBudgetInput
              value={group.section.name}
              onSave={async (name) => {
                const trimmed = name.trim();
                if (!trimmed || trimmed === group.section.name) return;
                await onUpdateSectionName(group.section.id, trimmed);
              }}
              ariaLabel={`Budget section ${group.section.name}`}
              className="h-9 border-transparent bg-transparent px-2 font-medium hover:border-input focus-visible:border-input"
            />
          ) : (
            <span className="truncate font-medium text-foreground">{group.section.name}</span>
          )}
        </div>
        <span className="text-right text-xs uppercase tracking-wide text-muted">Section</span>
        <span />
        <span />
        <span />
        <span />
        {editable ? (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Archive section ${group.section.name}`}
              onClick={() => onArchiveSection(group.section.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ) : (
          <span />
        )}
      </div>

      {!collapsed ? (
        <>
          {group.lines.map((line) => (
            <BudgetLineRow
              key={line.id}
              line={line}
              eventId={eventId}
              committedByLineId={committedByLineId}
              editable={editable}
              selected={selectedLineId === line.id}
              onOpen={() => onOpenLine(line)}
            />
          ))}
          <AddBudgetLineRow eventId={eventId} categoryId={group.section.id} editable={editable} />
          <BudgetTotalsRow label={`${group.section.name} subtotal`} totals={group.totals} />
        </>
      ) : null}
    </section>
  );
}

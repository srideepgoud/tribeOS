"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@tribeos/ui";

import type { CostItem } from "@/types/cost-item";

import type { BudgetSectionGroup } from "../../lib/budget-utils";
import { AddBudgetLineRow } from "./add-budget-line-row";
import { BudgetTotalsRow } from "./budget-columns";
import { BudgetLineRow } from "./budget-line-row";
import { InlineBudgetInput } from "./inline-budget-input";

interface BudgetSectionBlockProps {
  group: BudgetSectionGroup;
  eventId: string;
  committedByLineId: Readonly<Record<string, number>>;
  editable: boolean;
  selectedLineId: string | null;
  focusAddLine: boolean;
  onConsumedAddLineFocus: () => void;
  onOpenLine: (line: CostItem) => void;
  onArchiveSection: (sectionId: string) => void;
  onUpdateSectionName: (sectionId: string, name: string) => Promise<void>;
  onAssignVendor: (line: CostItem) => void;
  onRecordExpense: (line: CostItem) => void;
}

export function BudgetSectionBlock({
  group,
  eventId,
  committedByLineId,
  editable,
  selectedLineId,
  focusAddLine,
  onConsumedAddLineFocus,
  onOpenLine,
  onArchiveSection,
  onUpdateSectionName,
  onAssignVendor,
  onRecordExpense,
}: BudgetSectionBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isEmpty = group.lines.length === 0;

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
          {isEmpty ? (
            <div className="border-b border-border/60 px-4 py-3 pl-14 text-sm text-muted">
              No budget lines yet. Add the first line below.
            </div>
          ) : null}
          {group.lines.map((line) => (
            <BudgetLineRow
              key={line.id}
              line={line}
              eventId={eventId}
              committedByLineId={committedByLineId}
              editable={editable}
              selected={selectedLineId === line.id}
              onOpen={() => onOpenLine(line)}
              onAssignVendor={() => onAssignVendor(line)}
              onRecordExpense={() => onRecordExpense(line)}
            />
          ))}
          <AddBudgetLineRow
            eventId={eventId}
            categoryId={group.section.id}
            editable={editable}
            autoFocus={focusAddLine}
            onConsumedAutoFocus={onConsumedAddLineFocus}
          />
          <BudgetTotalsRow label={`${group.section.name} subtotal`} totals={group.totals} />
        </>
      ) : null}
    </section>
  );
}

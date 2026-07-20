"use client";

import { useEffect, useRef, useState } from "react";
import { ArchiveCostCategoryDialog } from "@/features/cost-categories/components/archive-cost-category-dialog";
import { useUpdateCostCategory } from "@/features/cost-categories/hooks";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";

import type { BudgetSectionGroup, BudgetTotals } from "../../lib/budget-utils";
import { AddBudgetSectionRow } from "./add-budget-section-row";
import { BudgetColumnHeader, BudgetTotalsRow } from "./budget-columns";
import { BudgetSectionBlock } from "./budget-section-block";

interface BudgetTreeProps {
  eventId: string;
  sections: readonly BudgetSectionGroup[];
  categories: readonly CostCategory[];
  committedByLineId: Readonly<Record<string, number>>;
  eventTotals: BudgetTotals;
  editable: boolean;
  selectedLineId: string | null;
  onOpenLine: (line: CostItem) => void;
  onAssignVendor: (line: CostItem) => void;
  onRecordExpense: (line: CostItem) => void;
}

export function BudgetTree({
  eventId,
  sections,
  categories,
  committedByLineId,
  eventTotals,
  editable,
  selectedLineId,
  onOpenLine,
  onAssignVendor,
  onRecordExpense,
}: BudgetTreeProps) {
  const updateSection = useUpdateCostCategory();
  const [archivingSection, setArchivingSection] = useState<CostCategory | null>(null);
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [totalsFlash, setTotalsFlash] = useState(0);
  const previousPlanned = useRef(eventTotals.planned);

  useEffect(() => {
    if (previousPlanned.current !== eventTotals.planned) {
      previousPlanned.current = eventTotals.planned;
      setTotalsFlash((value) => value + 1);
    }
  }, [eventTotals.planned]);

  const onUpdateSectionName = async (sectionId: string, name: string) => {
    await updateSection.mutateAsync({ id: sectionId, input: { name } });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <BudgetColumnHeader />

      {sections.map((group) => (
        <BudgetSectionBlock
          key={group.section.id}
          group={group}
          eventId={eventId}
          committedByLineId={committedByLineId}
          editable={editable}
          selectedLineId={selectedLineId}
          focusAddLine={focusSectionId === group.section.id}
          onConsumedAddLineFocus={() => setFocusSectionId(null)}
          onOpenLine={onOpenLine}
          onArchiveSection={(sectionId) => {
            const section = categories.find((item) => item.id === sectionId) ?? null;
            setArchivingSection(section);
          }}
          onUpdateSectionName={onUpdateSectionName}
          onAssignVendor={onAssignVendor}
          onRecordExpense={onRecordExpense}
        />
      ))}

      <AddBudgetSectionRow
        eventId={eventId}
        categories={categories}
        editable={editable}
        emphasized={sections.length === 0}
        onCreated={(sectionId) => setFocusSectionId(sectionId)}
      />
      {sections.length > 0 ? (
        <BudgetTotalsRow
          label="Event budget total"
          totals={eventTotals}
          emphasized
          flashKey={totalsFlash}
        />
      ) : null}

      <ArchiveCostCategoryDialog
        open={archivingSection !== null}
        onOpenChange={(open) => {
          if (!open) setArchivingSection(null);
        }}
        category={archivingSection}
      />
    </div>
  );
}

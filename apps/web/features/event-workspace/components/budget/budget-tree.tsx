"use client";

import { useState } from "react";
import { Input } from "@tribeos/ui";

import { ArchiveCostCategoryDialog } from "@/features/cost-categories/components/archive-cost-category-dialog";
import { useCreateCostCategory, useUpdateCostCategory } from "@/features/cost-categories/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";

import type { BudgetSectionGroup, BudgetTotals } from "../../lib/budget-utils";
import { nextSectionDisplayOrder } from "../../lib/budget-utils";
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
}

function AddSectionRow({
  eventId,
  categories,
  editable,
}: {
  eventId: string;
  categories: readonly CostCategory[];
  editable: boolean;
}) {
  const createSection = useCreateCostCategory();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!editable) return null;

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await createSection.mutateAsync({
        event_id: eventId,
        name: trimmed,
        display_order: nextSectionDisplayOrder(categories),
      });
      setName("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create budget section."));
    }
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="+ Add budget section"
        aria-label="New budget section name"
        className="max-w-md"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
        }}
        onBlur={() => void commit()}
      />
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
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
}: BudgetTreeProps) {
  const updateSection = useUpdateCostCategory();
  const [archivingSection, setArchivingSection] = useState<CostCategory | null>(null);

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
          onOpenLine={onOpenLine}
          onArchiveSection={(sectionId) => {
            const section = categories.find((item) => item.id === sectionId) ?? null;
            setArchivingSection(section);
          }}
          onUpdateSectionName={onUpdateSectionName}
        />
      ))}

      <AddSectionRow eventId={eventId} categories={categories} editable={editable} />
      <BudgetTotalsRow label="Event total" totals={eventTotals} emphasized />

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

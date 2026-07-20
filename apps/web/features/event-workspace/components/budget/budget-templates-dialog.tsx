"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from "@tribeos/ui";

import { useCreateCostCategory } from "@/features/cost-categories/hooks";
import { useCreateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import type { BudgetSectionGroup } from "../../lib/budget-utils";
import { nextSectionDisplayOrder } from "../../lib/budget-utils";
import {
  buildTemplateSections,
  deleteBudgetTemplate,
  listBudgetTemplates,
  saveBudgetTemplate,
  type BudgetTemplate,
} from "../../lib/budget-templates";

interface BudgetTemplatesDialogProps {
  eventId: string;
  sections: readonly BudgetSectionGroup[];
  categories: readonly CostCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetTemplatesDialog({
  eventId,
  sections,
  categories,
  open,
  onOpenChange,
}: BudgetTemplatesDialogProps) {
  const createCategory = useCreateCostCategory();
  const createItem = useCreateCostItem();
  const [templates, setTemplates] = useState<BudgetTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTemplates(listBudgetTemplates());
    setError(null);
  }, [open]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [templates, selectedTemplateId],
  );

  const canSaveCurrent = sections.length > 0 && templateName.trim().length > 0;
  const canApply = Boolean(selectedTemplate) && !createItem.isPending;

  const onSaveCurrent = () => {
    if (!canSaveCurrent) return;
    const serialized = buildTemplateSections(sections);
    if (serialized.length === 0) {
      setError("Current budget has no lines to save as a template.");
      return;
    }
    const created = saveBudgetTemplate(templateName, serialized);
    setTemplates((current) => [created, ...current]);
    setSelectedTemplateId(created.id);
    setTemplateName("");
    setError(null);
  };

  const onDeleteTemplate = (templateId: string) => {
    const next = deleteBudgetTemplate(templateId);
    setTemplates(next);
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId("");
    }
  };

  const onApplyTemplate = async () => {
    if (!selectedTemplate) return;
    setError(null);
    try {
      let displayOrder = nextSectionDisplayOrder(categories);
      for (const section of selectedTemplate.sections) {
        const createdSection = await createCategory.mutateAsync({
          event_id: eventId,
          name: section.name,
          display_order: displayOrder,
        });
        displayOrder += 1;

        for (const line of section.lines) {
          await createItem.mutateAsync({
            event_id: eventId,
            category_id: createdSection.id,
            title: line.title,
            expense_type: "Vendor",
            budget_amount: line.budgetAmount,
            vendor_required: true,
          });
        }
      }
      onOpenChange(false);
    } catch (applyError) {
      setError(apiErrorMessage(applyError, "Could not apply budget template."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Budget templates</DialogTitle>
          <DialogDescription>
            Save the current budget structure as a reusable template, or apply a saved template to this event.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-medium text-foreground">Save current budget</h3>
            <p className="mt-1 text-xs text-muted">Saves section and line structure with planned amounts.</p>
            <Input
              className="mt-3"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Template name"
              aria-label="Template name"
            />
            <Button className="mt-3 w-full" onClick={onSaveCurrent} disabled={!canSaveCurrent}>
              Save template
            </Button>
          </section>

          <section className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-medium text-foreground">Apply saved template</h3>
            <p className="mt-1 text-xs text-muted">Creates new sections and lines in this event.</p>
            <div className="mt-3 max-h-56 overflow-auto rounded-md border border-border">
              {templates.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">No templates saved yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {templates.map((template) => {
                    const selected = selectedTemplateId === template.id;
                    const lineCount = template.sections.reduce((sum, section) => sum + section.lines.length, 0);
                    return (
                      <li key={template.id} className="flex items-start justify-between gap-2 px-3 py-2">
                        <button
                          type="button"
                          className={selected ? "text-left text-sm text-foreground" : "text-left text-sm text-muted"}
                          onClick={() => setSelectedTemplateId(template.id)}
                        >
                          <p className="font-medium">{template.name}</p>
                          <p className="text-xs">
                            {template.sections.length} section(s) • {lineCount} line(s)
                          </p>
                        </button>
                        <Button variant="ghost" size="sm" onClick={() => onDeleteTemplate(template.id)}>
                          Delete
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <Button className="mt-3 w-full" onClick={() => void onApplyTemplate()} disabled={!canApply}>
              Apply template
            </Button>
          </section>
        </div>

        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

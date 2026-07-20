import type { BudgetSectionGroup } from "./budget-utils";

const STORAGE_KEY = "tribeos-budget-templates-v1";

export interface BudgetTemplateLine {
  readonly title: string;
  readonly budgetAmount: string;
}

export interface BudgetTemplateSection {
  readonly name: string;
  readonly lines: readonly BudgetTemplateLine[];
}

export interface BudgetTemplate {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly sections: readonly BudgetTemplateSection[];
}

export function buildTemplateSections(sections: readonly BudgetSectionGroup[]): BudgetTemplateSection[] {
  return sections
    .map((group) => ({
      name: group.section.name,
      lines: group.lines.map((line) => ({
        title: line.title,
        budgetAmount: line.budget_amount,
      })),
    }))
    .filter((section) => section.lines.length > 0);
}

function safeParseTemplates(raw: string | null): BudgetTemplate[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BudgetTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listBudgetTemplates(): BudgetTemplate[] {
  if (typeof window === "undefined") return [];
  return safeParseTemplates(window.localStorage.getItem(STORAGE_KEY));
}

function writeTemplates(templates: readonly BudgetTemplate[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function saveBudgetTemplate(name: string, sections: readonly BudgetTemplateSection[]): BudgetTemplate {
  const template: BudgetTemplate = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    sections,
  };
  const current = listBudgetTemplates();
  writeTemplates([template, ...current]);
  return template;
}

export function deleteBudgetTemplate(templateId: string): BudgetTemplate[] {
  const next = listBudgetTemplates().filter((template) => template.id !== templateId);
  writeTemplates(next);
  return next;
}

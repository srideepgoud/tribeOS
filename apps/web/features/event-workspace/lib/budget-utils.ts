import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
import type { EventStatus } from "@/types/event";
import type { Transaction } from "@/types/transaction";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

import { statusRank } from "../constants";

export interface BudgetSectionGroup {
  readonly section: CostCategory;
  readonly lines: readonly CostItem[];
  readonly totals: BudgetTotals;
}

export interface BudgetTotals {
  readonly planned: number;
  readonly committed: number;
  readonly actual: number;
  readonly variance: number;
}

/** Budget Sections/Lines are editable from Draft through Execution; frozen at Settlement+. */
export function isBudgetEditable(eventStatus: EventStatus): boolean {
  if (eventStatus === "Cancelled" || eventStatus === "Closed") return false;
  return statusRank(eventStatus) < statusRank("Settlement");
}

export function budgetEditingMessage(eventStatus: EventStatus): string | null {
  if (isBudgetEditable(eventStatus)) return null;
  if (eventStatus === "Cancelled") return "This event is cancelled.";
  if (eventStatus === "Closed" || statusRank(eventStatus) >= statusRank("Settlement")) {
    return "Budget is frozen during Settlement and after Close.";
  }
  return null;
}

export function buildCommittedByLineId(
  workOrders: readonly VendorWorkOrder[],
): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const order of workOrders) {
    if (order.status === "Cancelled") continue;
    totals[order.cost_item_id] = (totals[order.cost_item_id] ?? 0) + Number(order.agreed_amount);
  }
  return totals;
}

export function computeLineTotals(
  line: CostItem,
  committedByLineId: Readonly<Record<string, number>>,
): BudgetTotals {
  const planned = Number(line.budget_amount);
  const committed = committedByLineId[line.id] ?? 0;
  const actual = Number(line.actual_amount ?? 0);
  return {
    planned,
    committed,
    actual,
    variance: planned - actual,
  };
}

export function computeBudgetTotals(
  lines: readonly CostItem[],
  committedByLineId: Readonly<Record<string, number>>,
): BudgetTotals {
  return lines.reduce<BudgetTotals>(
    (acc, line) => {
      const lineTotals = computeLineTotals(line, committedByLineId);
      return {
        planned: acc.planned + lineTotals.planned,
        committed: acc.committed + lineTotals.committed,
        actual: acc.actual + lineTotals.actual,
        variance: acc.variance + lineTotals.variance,
      };
    },
    { planned: 0, committed: 0, actual: 0, variance: 0 },
  );
}

export function groupBudgetSections(
  sections: readonly CostCategory[],
  lines: readonly CostItem[],
  committedByLineId: Readonly<Record<string, number>>,
): BudgetSectionGroup[] {
  const activeSections = sections
    .filter((section) => !section.archived_at)
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  return activeSections.map((section) => {
    const sectionLines = lines
      .filter((line) => line.category_id === section.id && !line.archived_at)
      .sort((a, b) => a.title.localeCompare(b.title));
    return {
      section,
      lines: sectionLines,
      totals: computeBudgetTotals(sectionLines, committedByLineId),
    };
  });
}

export function nextSectionDisplayOrder(sections: readonly CostCategory[]): number {
  const active = sections.filter((section) => !section.archived_at);
  if (active.length === 0) return 0;
  return Math.max(...active.map((section) => section.display_order)) + 1;
}

export function parseBudgetAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  if (Number.isNaN(amount) || amount < 0) return null;
  return amount.toFixed(2);
}

export type LineAttributionState =
  | "No spend"
  | "Unattributed"
  | "Partially Attributed"
  | "Fully Attributed";

export interface LineAttributionSummary {
  readonly cashRecorded: number;
  readonly attributed: number;
  readonly state: LineAttributionState;
}

export function computeLineAttribution(
  line: CostItem,
  transactions: readonly Transaction[],
): LineAttributionSummary {
  const expenseTypes = new Set(["Vendor Payment", "Internal Expense"]);
  const cashRecorded = transactions
    .filter(
      (txn) =>
        txn.cost_item_id === line.id &&
        expenseTypes.has(txn.transaction_type) &&
        txn.status === "Completed",
    )
    .reduce((sum, txn) => sum + Number(txn.amount), 0);
  const attributed = Number(line.actual_amount ?? 0);

  let state: LineAttributionState;
  if (cashRecorded <= 0) {
    state = "No spend";
  } else if (attributed <= 0) {
    state = "Unattributed";
  } else if (attributed + 1e-9 < cashRecorded) {
    state = "Partially Attributed";
  } else {
    state = "Fully Attributed";
  }

  return { cashRecorded, attributed, state };
}

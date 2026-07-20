import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
import type { VendorWorkOrder, VendorWorkOrderStatus } from "@/types/vendor-work-order";

import { buildCommittedByLineId, groupBudgetSections } from "./budget-utils";

export interface ExecutionLineGroup {
  readonly line: CostItem;
  readonly workOrders: readonly VendorWorkOrder[];
  readonly committed: number;
  readonly planned: number;
  readonly covered: boolean;
}

export interface ExecutionSectionGroup {
  readonly section: CostCategory;
  readonly lines: readonly ExecutionLineGroup[];
}

export function isVendorLine(line: CostItem): boolean {
  return line.expense_type === "Vendor" && !line.archived_at;
}

export function groupExecutionBySection(
  sections: readonly CostCategory[],
  items: readonly CostItem[],
  workOrders: readonly VendorWorkOrder[],
): ExecutionSectionGroup[] {
  const committedByLineId = buildCommittedByLineId(workOrders);
  const budgetSections = groupBudgetSections(sections, items, committedByLineId);
  const ordersByLineId = new Map<string, VendorWorkOrder[]>();

  for (const order of workOrders) {
    if (order.status === "Cancelled") continue;
    const existing = ordersByLineId.get(order.cost_item_id) ?? [];
    existing.push(order);
    ordersByLineId.set(order.cost_item_id, existing);
  }

  return budgetSections
    .map((group) => ({
      section: group.section,
      lines: group.lines
        .filter(isVendorLine)
        .map((line) => {
          const lineOrders = ordersByLineId.get(line.id) ?? [];
          const committed = committedByLineId[line.id] ?? 0;
          return {
            line,
            workOrders: lineOrders,
            committed,
            planned: Number(line.budget_amount),
            covered: lineOrders.length > 0,
          };
        }),
    }))
    .filter((group) => group.lines.length > 0);
}

export function filterExecutionGroups(
  groups: readonly ExecutionSectionGroup[],
  options: {
    search: string;
    status: VendorWorkOrderStatus | "all";
    vendorNames: Readonly<Record<string, string>>;
  },
): ExecutionSectionGroup[] {
  const query = options.search.trim().toLowerCase();
  const { status, vendorNames } = options;

  return groups
    .map((group) => ({
      ...group,
      lines: group.lines
        .map((lineGroup) => {
          const matchingOrders = lineGroup.workOrders.filter((order) => {
            if (status !== "all" && order.status !== status) return false;
            if (!query) return true;
            const vendorName = vendorNames[order.vendor_id]?.toLowerCase() ?? "";
            return (
              lineGroup.line.title.toLowerCase().includes(query) ||
              order.work_order_number.toLowerCase().includes(query) ||
              vendorName.includes(query)
            );
          });

          const lineMatches =
            query.length > 0 && lineGroup.line.title.toLowerCase().includes(query);

          if (status !== "all") {
            return { ...lineGroup, workOrders: matchingOrders };
          }

          if (!query) return lineGroup;

          if (lineMatches || matchingOrders.length > 0) {
            return { ...lineGroup, workOrders: matchingOrders };
          }

          return null;
        })
        .filter((lineGroup): lineGroup is ExecutionLineGroup => lineGroup !== null)
        .filter((lineGroup) => {
          if (status === "all") return true;
          return lineGroup.workOrders.length > 0;
        }),
    }))
    .filter((group) => group.lines.length > 0);
}

export function executionCoverage(
  groups: readonly ExecutionSectionGroup[],
): { covered: number; total: number; committed: number; planned: number } {
  let covered = 0;
  let total = 0;
  let committed = 0;
  let planned = 0;

  for (const group of groups) {
    for (const lineGroup of group.lines) {
      total += 1;
      planned += lineGroup.planned;
      committed += lineGroup.committed;
      if (lineGroup.covered) covered += 1;
    }
  }

  return { covered, total, committed, planned };
}

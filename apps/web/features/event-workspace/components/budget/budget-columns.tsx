import { formatMoney } from "@/lib/money";

import type { BudgetTotals } from "../../lib/budget-utils";

interface BudgetAmountCellProps {
  value: number;
  className?: string;
}

export function BudgetAmountCell({ value, className }: BudgetAmountCellProps) {
  return (
    <span className={`tabular-nums text-foreground-secondary ${className ?? ""}`}>
      {formatMoney(value.toFixed(2))}
    </span>
  );
}

interface BudgetTotalsRowProps {
  label: string;
  totals: BudgetTotals;
  emphasized?: boolean;
}

export function BudgetTotalsRow({ label, totals, emphasized = false }: BudgetTotalsRowProps) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem] items-center gap-3 border-t border-border px-4 py-3 text-sm ${
        emphasized ? "bg-surface font-medium" : "bg-background-secondary/50"
      }`}
    >
      <span className={emphasized ? "text-foreground" : "text-muted"}>{label}</span>
      <BudgetAmountCell value={totals.planned} className="text-right" />
      <BudgetAmountCell value={totals.committed} className="text-right" />
      <BudgetAmountCell value={totals.actual} className="text-right" />
      <BudgetAmountCell value={totals.variance} className="text-right" />
    </div>
  );
}

export function BudgetColumnHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_6rem_3rem] items-center gap-3 border-b border-border bg-background-secondary px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
      <span>Budget line</span>
      <span className="text-right">Planned</span>
      <span className="text-right">Committed</span>
      <span className="text-right">Actual</span>
      <span className="text-right">Variance</span>
      <span>Status</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

import { formatMoney } from "@/lib/money";

import type { BudgetTotals } from "../../lib/budget-utils";

interface BudgetAmountCellProps {
  value: number;
  className?: string;
  /** Derived values look quieter than editable Budget. */
  derived?: boolean;
}

export function BudgetAmountCell({ value, className, derived = false }: BudgetAmountCellProps) {
  return (
    <span
      className={`tabular-nums ${
        derived ? "text-muted" : "text-foreground-secondary"
      } ${className ?? ""}`}
    >
      {formatMoney(value.toFixed(2))}
    </span>
  );
}

interface BudgetTotalsRowProps {
  label: string;
  totals: BudgetTotals;
  emphasized?: boolean;
  flashKey?: number;
}

export function BudgetTotalsRow({
  label,
  totals,
  emphasized = false,
  flashKey = 0,
}: BudgetTotalsRowProps) {
  return (
    <div
      key={flashKey}
      className={`grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem] items-center gap-3 border-t border-border px-4 py-3 text-sm transition-colors ${
        emphasized ? "bg-surface font-medium" : "bg-background-secondary/50"
      } ${flashKey > 0 ? "animate-pulse bg-primary/5" : ""}`}
    >
      <span className={emphasized ? "text-foreground" : "text-muted"}>{label}</span>
      <BudgetAmountCell value={totals.planned} className="text-right font-medium text-foreground" />
      <BudgetAmountCell value={totals.committed} className="text-right" derived />
      <BudgetAmountCell value={totals.actual} className="text-right" derived />
      <BudgetAmountCell value={totals.variance} className="text-right" derived />
    </div>
  );
}

export function BudgetColumnHeader() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem_7rem_7rem_7rem_6rem_3rem] items-center gap-3 border-b border-border bg-background-secondary px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
      <span>Budget line</span>
      <span className="text-right" title="Editable planned budget">
        Budget
        <span className="ml-1 font-normal normal-case text-[10px]">edit</span>
      </span>
      <span className="text-right" title="Derived from Vendor Work Orders">
        Committed
        <span className="ml-1 block font-normal normal-case text-[10px] opacity-70">from WOs</span>
      </span>
      <span className="text-right" title="Derived from attributed spend">
        Actual
        <span className="ml-1 block font-normal normal-case text-[10px] opacity-70">from spend</span>
      </span>
      <span className="text-right" title="Budget − Actual">
        Variance
        <span className="ml-1 block font-normal normal-case text-[10px] opacity-70">calc</span>
      </span>
      <span>Status</span>
      <span className="sr-only">Actions</span>
    </div>
  );
}

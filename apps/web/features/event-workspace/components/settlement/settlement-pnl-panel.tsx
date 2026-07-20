"use client";

import { formatMoney } from "@/lib/money";

import type { SettlementPnl } from "../../lib/settlement-utils";

interface SettlementPnlPanelProps {
  pnl: SettlementPnl;
}

function formatMargin(marginPercent: number | null): string {
  if (marginPercent === null) return "—";
  return `${marginPercent.toFixed(1)}%`;
}

export function SettlementPnlPanel({ pnl }: SettlementPnlPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-foreground">Event P&amp;L</h3>
        <p className="text-xs text-muted">All figures are derived from billed revenue and attributed cost.</p>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Metric label="Billed revenue" value={formatMoney(pnl.billedRevenue.toFixed(2))} />
        <Metric label="Attributed cost" value={formatMoney(pnl.attributedCost.toFixed(2))} />
        <Metric
          label="Profit (derived)"
          value={formatMoney(pnl.profit.toFixed(2))}
          highlight={pnl.profit >= 0 ? "positive" : "negative"}
        />
        <Metric label="Margin (derived)" value={formatMargin(pnl.marginPercent)} />
      </dl>
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={
          highlight === "positive"
            ? "text-lg font-semibold tabular-nums text-success"
            : highlight === "negative"
              ? "text-lg font-semibold tabular-nums text-danger"
              : "text-lg font-semibold tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

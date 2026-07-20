"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, cn } from "@tribeos/ui";

import type { ReadinessIndicator, ReadinessStatus } from "../../hooks";

const STATUS_STYLES: Record<ReadinessStatus, string> = {
  done: "border-success/30 bg-success/5",
  attention: "border-warning/30 bg-warning/5",
  blocked: "border-danger/30 bg-danger/5",
  not_started: "border-border bg-card",
};

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  done: "Done",
  attention: "Attention",
  blocked: "Blocked",
  not_started: "Not started",
};

interface ReadinessCardProps {
  indicator: ReadinessIndicator;
  profitValue?: string | null;
}

function formatProfit(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ReadinessCard({ indicator, profitValue }: ReadinessCardProps) {
  const detail =
    indicator.id === "profit" && profitValue !== null && profitValue !== undefined
      ? formatProfit(profitValue)
      : indicator.detail;

  return (
    <Link
      href={indicator.href}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:border-primary/40",
        STATUS_STYLES[indicator.status],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{indicator.label}</p>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {STATUS_LABEL[indicator.status]}
        </span>
      </div>
      <p className="text-sm text-foreground-secondary">{detail}</p>
      <span className="mt-auto inline-flex items-center gap-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
        Open
        <ArrowRight className="size-3" />
      </span>
    </Link>
  );
}

interface ReadinessBoardProps {
  indicators: readonly ReadinessIndicator[];
  profitForecast: string | null;
}

export function ReadinessBoard({ indicators, profitForecast }: ReadinessBoardProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {indicators.map((indicator) => (
        <ReadinessCard
          key={indicator.id}
          indicator={indicator}
          profitValue={indicator.id === "profit" ? profitForecast : undefined}
        />
      ))}
    </div>
  );
}

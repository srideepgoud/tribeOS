"use client";

import type { DashboardAttention } from "@/types/dashboard";

interface AttentionCardProps {
  label: string;
  count: number;
  description: string;
}

function AttentionCard({ label, count, description }: AttentionCardProps) {
  const needsAttention = count > 0;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <span
          className={
            needsAttention
              ? "text-2xl font-semibold text-warning"
              : "text-2xl font-semibold text-foreground"
          }
        >
          {count}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">{description}</p>
    </div>
  );
}

interface AttentionSectionProps {
  attention: DashboardAttention;
}

export function AttentionSection({ attention }: AttentionSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Action Required</h2>
        <p className="text-sm text-muted">Events that need attention before Financial Close.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AttentionCard
          label="Outstanding Receivables"
          count={attention.outstanding_events}
          description="Events with Outstanding greater than zero"
        />
        <AttentionCard
          label="Pending Transactions"
          count={attention.pending_transactions}
          description="Events with pending financial transactions"
        />
        <AttentionCard
          label="Unattributed Spend"
          count={attention.unattributed_events}
          description="Events with completed cash not yet allocated"
        />
        <AttentionCard
          label="Ready To Close"
          count={attention.ready_to_close_events}
          description="Settlement events that pass financial readiness"
        />
      </div>
    </section>
  );
}

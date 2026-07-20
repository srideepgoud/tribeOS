"use client";

import type { FinancialReadiness } from "@/types/event";

const CHECKS: {
  key: keyof FinancialReadiness["checks"];
  passLabel: string;
  failLabel: string;
}[] = [
  {
    key: "outstanding",
    passLabel: "Outstanding cleared",
    failLabel: "Outstanding invoices remain",
  },
  {
    key: "unattributed_spend",
    passLabel: "All spend allocated",
    failLabel: "Unattributed spend remains",
  },
  {
    key: "pending_transactions",
    passLabel: "No pending financial transactions",
    failLabel: "Pending financial transactions remain",
  },
];

interface FinancialReadinessPanelProps {
  readiness: FinancialReadiness | undefined;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function FinancialReadinessPanel({
  readiness,
  isLoading,
  errorMessage,
}: FinancialReadinessPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-background-secondary p-4">
        <h3 className="text-sm font-medium text-foreground">Financial readiness</h3>
        <p className="mt-2 text-sm text-muted">Checking close gates…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-border bg-background-secondary p-4">
        <h3 className="text-sm font-medium text-foreground">Financial readiness</h3>
        <p className="mt-2 text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (!readiness) return null;

  return (
    <div className="rounded-lg border border-border bg-background-secondary p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Financial readiness</h3>
        <span
          className={
            readiness.ready ? "text-sm font-medium text-success" : "text-sm font-medium text-warning"
          }
        >
          {readiness.ready ? "Ready to close" : "Not ready"}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {CHECKS.map((check) => {
          const ok = readiness.checks[check.key];
          return (
            <li key={check.key} className="flex items-start gap-2 text-sm">
              <span aria-hidden className={ok ? "text-success" : "text-danger"}>
                {ok ? "✓" : "✗"}
              </span>
              <span className={ok ? "text-foreground" : "text-foreground-secondary"}>
                {ok ? check.passLabel : check.failLabel}
              </span>
            </li>
          );
        })}
      </ul>
      {!readiness.ready && readiness.blocking_reasons.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {readiness.blocking_reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-muted">
        Close Event is enabled only when the backend reports all checks passing.
      </p>
    </div>
  );
}

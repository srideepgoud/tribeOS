"use client";

import Link from "next/link";
import type { FinancialReadiness } from "@/types/event";

import { gateHref } from "../../lib/settlement-utils";

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

interface SettlementGatesProps {
  eventId: string;
  readiness: FinancialReadiness | undefined;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function SettlementGates({
  eventId,
  readiness,
  isLoading,
  errorMessage,
}: SettlementGatesProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Close gates</h3>
        <p className="mt-2 text-sm text-muted">Checking financial readiness…</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground">Close gates</h3>
        <p className="mt-2 text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (!readiness) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">Close gates</h3>
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
            <li key={check.key} className="flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-2">
                <span aria-hidden className={ok ? "text-success" : "text-danger"}>
                  {ok ? "✓" : "✗"}
                </span>
                <span className={ok ? "text-foreground" : "text-foreground-secondary"}>
                  {ok ? check.passLabel : check.failLabel}
                </span>
              </div>
              {!ok ? (
                <Link
                  href={gateHref(eventId, check.key)}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Resolve
                </Link>
              ) : null}
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
    </div>
  );
}

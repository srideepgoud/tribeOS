"use client";

import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import { EventStatusBadge } from "@/features/events/components/event-status-badge";
import type { DashboardEventRow } from "@/types/dashboard";

import { formatMoney } from "./finance-cards";

interface DashboardEventTableProps {
  events: readonly DashboardEventRow[];
}

export function DashboardEventTable({ events }: DashboardEventTableProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background-secondary px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No active or settlement events</p>
        <p className="mt-1 text-sm text-muted">
          Operational events will appear here as work progresses.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Financial Ready</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => {
            const outstandingPositive = Number(event.outstanding) > 0;
            return (
              <TableRow key={event.id}>
                <TableCell className="font-medium text-foreground">
                  <div className="flex flex-col gap-1">
                      <Link
                      href="/events"
                      className="hover:text-primary hover:underline"
                    >
                      {event.name}
                    </Link>
                    {event.status === "Settlement" && event.financial_ready ? (
                      <Badge variant="success" className="w-fit">
                        Ready to Close
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-foreground-secondary">{event.client_name}</TableCell>
                <TableCell>
                  <EventStatusBadge status={event.status} />
                </TableCell>
                <TableCell className="text-right text-foreground-secondary">
                  {formatMoney(event.billed_revenue)}
                </TableCell>
                <TableCell className="text-right text-foreground-secondary">
                  {formatMoney(event.attributed_cost)}
                </TableCell>
                <TableCell className="text-right text-foreground-secondary">
                  {formatMoney(event.gross_profit)}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="text-foreground-secondary">
                      {formatMoney(event.outstanding)}
                    </span>
                    {outstandingPositive ? (
                      <Badge variant="warning">Outstanding</Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  {event.financial_ready ? (
                    <Badge variant="success">Ready</Badge>
                  ) : (
                    <Badge variant="warning">Attention Required</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

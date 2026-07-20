"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { Event } from "@/types/event";

import { EventStatusBadge } from "./event-status-badge";

interface EventTableProps {
  events: Event[];
  clientNames: Record<string, string>;
  onEdit: (event: Event) => void;
  onArchive: (event: Event) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function EventTable({ events, clientNames, onEdit, onArchive }: EventTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Venue</TableHead>
            <TableHead>Start</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium text-foreground">
                <Link
                  href={`/events/${event.id}/overview`}
                  className="hover:text-primary hover:underline"
                >
                  {event.name}
                </Link>
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {clientNames[event.client_id] ?? "—"}
              </TableCell>
              <TableCell>
                <EventStatusBadge status={event.status} />
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {[event.venue, event.city].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell className="text-muted">{formatDate(event.start_datetime)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${event.name}`}
                    onClick={() => onEdit(event)}
                  >
                    <Pencil />
                  </Button>
                  {event.status === "Draft" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Archive ${event.name}`}
                      onClick={() => onArchive(event)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

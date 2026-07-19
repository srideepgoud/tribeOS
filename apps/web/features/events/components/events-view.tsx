"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import { useClients } from "@/features/clients/hooks";
import { apiErrorMessage } from "@/services/http";
import type { Event, EventStatus } from "@/types/event";
import { EVENT_STATUSES } from "@/types/event";

import { useEvents } from "../hooks";
import { ArchiveEventDialog } from "./archive-event-dialog";
import { EventFormDialog } from "./event-form-dialog";
import { EventTable } from "./event-table";
import { EventsEmptyState } from "./events-empty-state";
import { EventsErrorState } from "./events-error-state";
import { EventsLoading } from "./events-loading";

const PAGE_SIZE = 20;

export function EventsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [archiving, setArchiving] = useState<Event | null>(null);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      q: search.trim() || undefined,
      sort: "-created_at",
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );
  const query = useEvents(params);
  const clientsQuery = useClients({ page: 1, page_size: 100, sort: "company_name" });

  const clientNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const client of clientsQuery.data?.data ?? []) {
      map[client.id] = client.company_name;
    }
    return map;
  }, [clientsQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const events = query.data?.data ?? [];
  const hasSearch = search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Events</h1>
          <p className="text-sm text-muted">Central planning unit for every Tribe engagement.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New event
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search events"
            aria-label="Search events"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as EventStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EVENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <EventsLoading />
      ) : query.isError ? (
        <EventsErrorState
          message={apiErrorMessage(query.error, "Something went wrong while loading events.")}
          onRetry={() => void query.refetch()}
        />
      ) : events.length === 0 ? (
        hasSearch ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No events match your filters.
          </div>
        ) : (
          <EventsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <EventTable
            events={events}
            clientNames={clientNames}
            onEdit={setEditing}
            onArchive={setArchiving}
          />
          {pagination && pagination.total_pages > 1 ? (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Page {pagination.page} of {pagination.total_pages} · {pagination.total_items} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <EventFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        event={editing}
      />
      <ArchiveEventDialog
        open={archiving !== null}
        onOpenChange={(open) => (!open ? setArchiving(null) : undefined)}
        event={archiving}
      />
    </div>
  );
}

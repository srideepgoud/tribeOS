"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tribeos/ui";

import { useCostCategories } from "@/features/cost-categories/hooks";
import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostItem, CostItemStatus } from "@/types/cost-item";
import { COST_ITEM_STATUSES } from "@/types/cost-item";

import { useCostItems } from "../hooks";
import { ArchiveCostItemDialog } from "./archive-cost-item-dialog";
import { CostItemFormDialog } from "./cost-item-form-dialog";
import { CostItemTable } from "./cost-item-table";
import { CostItemsEmptyState } from "./cost-items-empty-state";
import { CostItemsErrorState } from "./cost-items-error-state";
import { CostItemsLoading } from "./cost-items-loading";

const PAGE_SIZE = 20;

export function CostItemsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<CostItemStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CostItem | null>(null);
  const [archiving, setArchiving] = useState<CostItem | null>(null);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      q: search.trim() || undefined,
      sort: "-created_at",
      event_id: eventFilter === "all" ? undefined : eventFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, eventFilter, statusFilter],
  );
  const query = useCostItems(params);
  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const categoriesQuery = useCostCategories({ page: 1, page_size: 100, sort: "name" });

  const eventNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of eventsQuery.data?.data ?? []) map[event.id] = event.name;
    return map;
  }, [eventsQuery.data?.data]);

  const categoryNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const category of categoriesQuery.data?.data ?? []) map[category.id] = category.name;
    return map;
  }, [categoriesQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const items = query.data?.data ?? [];
  const hasFilters =
    search.trim().length > 0 || eventFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Cost Items</h1>
          <p className="text-sm text-muted">
            Atomic budget lines for an event, with commercial version history.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New cost item
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
            placeholder="Search cost items"
            aria-label="Search cost items"
            className="pl-9"
          />
        </div>
        <Select
          value={eventFilter}
          onValueChange={(value) => {
            setEventFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]" aria-label="Filter by event">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {(eventsQuery.data?.data ?? []).map((event) => (
              <SelectItem key={event.id} value={event.id}>
                {event.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as CostItemStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {COST_ITEM_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <CostItemsLoading />
      ) : query.isError ? (
        <CostItemsErrorState
          message={apiErrorMessage(query.error, "Something went wrong while loading cost items.")}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No cost items match your filters.
          </div>
        ) : (
          <CostItemsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <CostItemTable
            items={items}
            eventNames={eventNames}
            categoryNames={categoryNames}
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

      <CostItemFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultEventId={eventFilter === "all" ? undefined : eventFilter}
      />
      <CostItemFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        item={editing}
      />
      <ArchiveCostItemDialog
        open={archiving !== null}
        onOpenChange={(open) => (!open ? setArchiving(null) : undefined)}
        item={archiving}
      />
    </div>
  );
}

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

import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { useCostCategories } from "../hooks";
import { ArchiveCostCategoryDialog } from "./archive-cost-category-dialog";
import { CostCategoriesEmptyState } from "./cost-categories-empty-state";
import { CostCategoriesErrorState } from "./cost-categories-error-state";
import { CostCategoriesLoading } from "./cost-categories-loading";
import { CostCategoryFormDialog } from "./cost-category-form-dialog";
import { CostCategoryTable } from "./cost-category-table";

const PAGE_SIZE = 20;

export function CostCategoriesView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CostCategory | null>(null);
  const [archiving, setArchiving] = useState<CostCategory | null>(null);

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      q: search.trim() || undefined,
      sort: "display_order",
      event_id: eventFilter === "all" ? undefined : eventFilter,
    }),
    [page, search, eventFilter],
  );
  const query = useCostCategories(params);
  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });

  const eventNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of eventsQuery.data?.data ?? []) {
      map[event.id] = event.name;
    }
    return map;
  }, [eventsQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const categories = query.data?.data ?? [];
  const hasFilters = search.trim().length > 0 || eventFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Cost Categories</h1>
          <p className="text-sm text-muted">
            Logical groupings for budgeting and reporting within an event.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New category
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
            placeholder="Search categories"
            aria-label="Search categories"
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
          <SelectTrigger className="w-[240px]" aria-label="Filter by event">
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
      </div>

      {query.isLoading ? (
        <CostCategoriesLoading />
      ) : query.isError ? (
        <CostCategoriesErrorState
          message={apiErrorMessage(
            query.error,
            "Something went wrong while loading cost categories.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : categories.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No categories match your filters.
          </div>
        ) : (
          <CostCategoriesEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <CostCategoryTable
            categories={categories}
            eventNames={eventNames}
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

      <CostCategoryFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultEventId={eventFilter === "all" ? undefined : eventFilter}
      />
      <CostCategoryFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        category={editing}
      />
      <ArchiveCostCategoryDialog
        open={archiving !== null}
        onOpenChange={(open) => (!open ? setArchiving(null) : undefined)}
        category={archiving}
      />
    </div>
  );
}

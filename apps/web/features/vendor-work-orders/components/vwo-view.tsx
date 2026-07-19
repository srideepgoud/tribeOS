"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import { useCostItems } from "@/features/cost-items/hooks";
import { useVendors } from "@/features/vendors/hooks";
import { apiErrorMessage } from "@/services/http";
import type { VendorWorkOrder, VendorWorkOrderStatus } from "@/types/vendor-work-order";
import { VENDOR_WORK_ORDER_STATUSES } from "@/types/vendor-work-order";

import { useVendorWorkOrders } from "../hooks";
import { VendorWorkOrderFormDialog } from "./vwo-form-dialog";
import { VendorWorkOrdersEmptyState } from "./vwo-empty-state";
import { VendorWorkOrdersErrorState } from "./vwo-error-state";
import { VendorWorkOrdersLoading } from "./vwo-loading";
import { VendorWorkOrderTable } from "./vwo-table";

const PAGE_SIZE = 20;

export function VendorWorkOrdersView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorWorkOrderStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<VendorWorkOrder | null>(null);

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
  const query = useVendorWorkOrders(params);
  const vendorsQuery = useVendors({ page: 1, page_size: 100, sort: "company_name" });
  const costItemsQuery = useCostItems({ page: 1, page_size: 100, sort: "title" });

  const vendorNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const vendor of vendorsQuery.data?.data ?? []) {
      map[vendor.id] = vendor.company_name;
    }
    return map;
  }, [vendorsQuery.data?.data]);

  const costItemTitles = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of costItemsQuery.data?.data ?? []) {
      map[item.id] = item.title;
    }
    return map;
  }, [costItemsQuery.data?.data]);

  const pagination = query.data?.meta.pagination;
  const workOrders = query.data?.data ?? [];
  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Vendor Work Orders</h1>
          <p className="text-sm text-muted">
            Commercial agreements linking Cost Items to Vendors.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New work order
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
            placeholder="Search work orders"
            aria-label="Search work orders"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as VendorWorkOrderStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VENDOR_WORK_ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <VendorWorkOrdersLoading />
      ) : query.isError ? (
        <VendorWorkOrdersErrorState
          message={apiErrorMessage(
            query.error,
            "Something went wrong while loading vendor work orders.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : workOrders.length === 0 ? (
        hasFilters ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No work orders match your filters.
          </div>
        ) : (
          <VendorWorkOrdersEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <VendorWorkOrderTable
            workOrders={workOrders}
            vendorNames={vendorNames}
            costItemTitles={costItemTitles}
            onEdit={setEditing}
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

      <VendorWorkOrderFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <VendorWorkOrderFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        workOrder={editing}
      />
    </div>
  );
}

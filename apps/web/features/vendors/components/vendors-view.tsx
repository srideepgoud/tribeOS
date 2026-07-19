"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input } from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";
import type { Vendor } from "@/types/vendor";

import { useVendors } from "../hooks";
import { DeleteVendorDialog } from "./delete-vendor-dialog";
import { VendorFormDialog } from "./vendor-form-dialog";
import { VendorTable } from "./vendor-table";
import { VendorsEmptyState } from "./vendors-empty-state";
import { VendorsErrorState } from "./vendors-error-state";
import { VendorsLoading } from "./vendors-loading";

const PAGE_SIZE = 20;

export function VendorsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState<Vendor | null>(null);

  const params = useMemo(
    () => ({ page, page_size: PAGE_SIZE, q: search.trim() || undefined, sort: "-created_at" }),
    [page, search],
  );
  const query = useVendors(params);

  const pagination = query.data?.meta.pagination;
  const vendors = query.data?.data ?? [];
  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Vendors</h1>
          <p className="text-sm text-muted">Suppliers and service providers for Tribe events.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New vendor
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search vendors"
          aria-label="Search vendors"
          className="pl-9"
        />
      </div>

      {query.isLoading ? (
        <VendorsLoading />
      ) : query.isError ? (
        <VendorsErrorState
          message={apiErrorMessage(query.error, "Something went wrong while loading vendors.")}
          onRetry={() => void query.refetch()}
        />
      ) : vendors.length === 0 ? (
        hasSearch ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No vendors match your search.
          </div>
        ) : (
          <VendorsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <VendorTable vendors={vendors} onEdit={setEditing} onDelete={setDeleting} />
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

      <VendorFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <VendorFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        vendor={editing}
      />
      <DeleteVendorDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        vendor={deleting}
      />
    </div>
  );
}

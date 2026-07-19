"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input } from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";
import type { Client } from "@/types/client";

import { useClients } from "../hooks";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientTable } from "./client-table";
import { ClientsEmptyState } from "./clients-empty-state";
import { ClientsErrorState } from "./clients-error-state";
import { ClientsLoading } from "./clients-loading";
import { DeleteClientDialog } from "./delete-client-dialog";

const PAGE_SIZE = 20;

export function ClientsView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const params = useMemo(
    () => ({ page, page_size: PAGE_SIZE, q: search.trim() || undefined, sort: "-created_at" }),
    [page, search],
  );
  const query = useClients(params);

  const pagination = query.data?.meta.pagination;
  const clients = query.data?.data ?? [];
  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
          <p className="text-sm text-muted">Organizations and individuals hiring Tribe.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          New client
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
          placeholder="Search clients"
          aria-label="Search clients"
          className="pl-9"
        />
      </div>

      {query.isLoading ? (
        <ClientsLoading />
      ) : query.isError ? (
        <ClientsErrorState
          message={apiErrorMessage(query.error, "Something went wrong while loading clients.")}
          onRetry={() => void query.refetch()}
        />
      ) : clients.length === 0 ? (
        hasSearch ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
            No clients match your search.
          </div>
        ) : (
          <ClientsEmptyState onCreate={() => setCreateOpen(true)} />
        )
      ) : (
        <div className="flex flex-col gap-4">
          <ClientTable clients={clients} onEdit={setEditing} onDelete={setDeleting} />
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

      <ClientFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ClientFormDialog
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        client={editing}
      />
      <DeleteClientDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        client={deleting}
      />
    </div>
  );
}

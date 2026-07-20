"use client";

import { useMemo } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tribeos/ui";

import { useTransactions } from "@/features/transactions/hooks";
import { apiErrorMessage } from "@/services/http";
import type { ClientInvoice } from "@/types/client-invoice";

import { useUpdateClientInvoice } from "../hooks";
import { ClientInvoiceStatusBadge } from "./invoice-status-badge";

interface ClientInvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ClientInvoice | null;
  onEdit: (invoice: ClientInvoice) => void;
  onInvoiceChange: (invoice: ClientInvoice) => void;
}

export function ClientInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onEdit,
  onInvoiceChange,
}: ClientInvoiceDetailDialogProps) {
  const updateMutation = useUpdateClientInvoice();
  const receiptsQuery = useTransactions({
    page: 1,
    page_size: 50,
    client_invoice_id: invoice?.id,
    sort: "-transaction_date",
  });

  const receipts = useMemo(
    () => (receiptsQuery.data?.data ?? []).filter((row) => row.transaction_type === "Client Receipt"),
    [receiptsQuery.data?.data],
  );

  if (!invoice) return null;

  const canIssue = invoice.status === "Draft";
  const canCancel = invoice.status === "Draft" || invoice.status === "Issued";
  const canEdit =
    invoice.status === "Draft" ||
    invoice.status === "Issued" ||
    invoice.status === "Partially Paid";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {invoice.invoice_number}
            <ClientInvoiceStatusBadge status={invoice.status} />
          </DialogTitle>
          <DialogDescription>
            Outstanding {invoice.outstanding ?? "—"} · Total {invoice.total_amount}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted">Invoice date</dt>
              <dd>{invoice.invoice_date}</dd>
            </div>
            <div>
              <dt className="text-muted">Due date</dt>
              <dd>{invoice.due_date ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Amount</dt>
              <dd className="tabular-nums">{invoice.amount}</dd>
            </div>
            <div>
              <dt className="text-muted">GST</dt>
              <dd className="tabular-nums">{invoice.gst_amount}</dd>
            </div>
          </dl>
          {invoice.notes ? <p className="text-foreground-secondary">{invoice.notes}</p> : null}

          <div>
            <h3 className="mb-2 font-medium text-foreground">Receipt history</h3>
            {receiptsQuery.isLoading ? (
              <p className="text-muted">Loading receipts…</p>
            ) : receipts.length === 0 ? (
              <p className="text-muted">No Client Receipts yet.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {receipts.map((receipt) => (
                  <li
                    key={receipt.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <span className="text-foreground-secondary">
                      {receipt.transaction_date} · {receipt.status}
                    </span>
                    <span className="tabular-nums font-medium">{receipt.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {updateMutation.error ? (
            <p className="text-sm text-danger">{apiErrorMessage(updateMutation.error)}</p>
          ) : null}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {canEdit ? (
            <Button type="button" variant="outline" onClick={() => onEdit(invoice)}>
              Edit
            </Button>
          ) : null}
          {canIssue ? (
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={async () => {
                const updated = await updateMutation.mutateAsync({
                  id: invoice.id,
                  input: { status: "Issued" },
                });
                onInvoiceChange(updated);
              }}
            >
              Issue
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={async () => {
                const updated = await updateMutation.mutateAsync({
                  id: invoice.id,
                  input: { status: "Cancelled" },
                });
                onInvoiceChange(updated);
              }}
            >
              Cancel invoice
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

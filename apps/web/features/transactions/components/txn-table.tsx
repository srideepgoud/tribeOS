"use client";

import { Pencil } from "lucide-react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import type { Transaction } from "@/types/transaction";

import { TransactionStatusBadge } from "./txn-status-badge";

interface TransactionTableProps {
  transactions: Transaction[];
  eventNames: Record<string, string>;
  costItemTitles: Record<string, string>;
  onEdit: (transaction: Transaction) => void;
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TransactionTable({
  transactions,
  eventNames,
  costItemTitles,
  onEdit,
}: TransactionTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Cost Item</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="text-foreground-secondary">{txn.transaction_date}</TableCell>
              <TableCell className="font-medium text-foreground">{txn.transaction_type}</TableCell>
              <TableCell className="text-foreground-secondary">
                {eventNames[txn.event_id] ?? "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">
                {txn.cost_item_id ? (costItemTitles[txn.cost_item_id] ?? "—") : "—"}
              </TableCell>
              <TableCell className="text-foreground-secondary">{formatMoney(txn.amount)}</TableCell>
              <TableCell>
                <TransactionStatusBadge status={txn.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open transaction ${txn.reference_number ?? txn.id}`}
                  onClick={() => onEdit(txn)}
                >
                  <Pencil />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

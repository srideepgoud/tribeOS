"use client";

import { Pencil } from "lucide-react";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tribeos/ui";

import { TransactionStatusBadge } from "@/features/transactions/components/txn-status-badge";
import { formatMoney } from "@/lib/money";
import type { Transaction } from "@/types/transaction";

import { allocationHint, transactionFacet } from "../../lib/expenses-utils";

interface ExpensesTableProps {
  expenses: readonly Transaction[];
  costItemTitles: Readonly<Record<string, string>>;
  onOpen: (txn: Transaction) => void;
}

export function ExpensesTable({ expenses, costItemTitles, onOpen }: ExpensesTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Budget line</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Allocation</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="text-foreground-secondary">{txn.transaction_date}</TableCell>
              <TableCell className="font-medium text-foreground">{transactionFacet(txn)}</TableCell>
              <TableCell className="text-foreground-secondary">
                {txn.cost_item_id ? (costItemTitles[txn.cost_item_id] ?? "—") : "Shared/none"}
              </TableCell>
              <TableCell className="text-foreground-secondary">{txn.payment_method}</TableCell>
              <TableCell>
                <Badge variant={allocationHint(txn) === "Attributed" ? "success" : "warning"}>
                  {allocationHint(txn)}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums text-foreground-secondary">
                {formatMoney(txn.amount)}
              </TableCell>
              <TableCell>
                <TransactionStatusBadge status={txn.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Open expense ${txn.reference_number ?? txn.id}`}
                  onClick={() => onOpen(txn)}
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

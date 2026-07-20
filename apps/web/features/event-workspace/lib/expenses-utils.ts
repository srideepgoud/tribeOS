import type { EventFinancialSummary } from "@/types/cost-allocation";
import type {
  PaymentMethod,
  Transaction,
  TransactionStatus,
  TransactionType,
} from "@/types/transaction";

export const EXPENSE_FACETS = ["all", "Vendor Payments", "Misc Expenses", "Reimbursements"] as const;
export type ExpenseFacet = (typeof EXPENSE_FACETS)[number];

const EXPENSE_TYPES: readonly TransactionType[] = [
  "Vendor Payment",
  "Internal Expense",
  "Adjustment",
  "Refund",
  "Reversal",
];

export function isExpenseTransaction(txn: Transaction): boolean {
  return EXPENSE_TYPES.includes(txn.transaction_type);
}

export function transactionFacet(txn: Transaction): ExpenseFacet {
  if (txn.transaction_type === "Vendor Payment") return "Vendor Payments";
  if (txn.transaction_type === "Refund") return "Reimbursements";
  return "Misc Expenses";
}

export interface ExpenseFilterState {
  search: string;
  status: TransactionStatus | "all";
  facet: ExpenseFacet;
  paymentMethod: PaymentMethod | "all";
}

export function filterExpenses(
  transactions: readonly Transaction[],
  filters: ExpenseFilterState,
): Transaction[] {
  const q = filters.search.trim().toLowerCase();
  return transactions.filter((txn) => {
    if (!isExpenseTransaction(txn)) return false;
    if (filters.status !== "all" && txn.status !== filters.status) return false;
    if (filters.facet !== "all" && transactionFacet(txn) !== filters.facet) return false;
    if (filters.paymentMethod !== "all" && txn.payment_method !== filters.paymentMethod) return false;
    if (!q) return true;
    return (
      txn.transaction_type.toLowerCase().includes(q) ||
      (txn.reference_number ?? "").toLowerCase().includes(q) ||
      (txn.remarks ?? "").toLowerCase().includes(q)
    );
  });
}

export function expenseCards(summary: EventFinancialSummary | undefined) {
  return {
    cashSpent: summary?.cash_spent ?? "0",
    attributedCost: summary?.attributed_cost ?? "0",
    unattributedSpend: summary?.unattributed_spend ?? "0",
  };
}

export function allocationHint(txn: Transaction): "Pending" | "Attributed" | "Review allocations" {
  if (txn.status !== "Completed") return "Pending";
  if (txn.cost_item_id) return "Attributed";
  return "Review allocations";
}

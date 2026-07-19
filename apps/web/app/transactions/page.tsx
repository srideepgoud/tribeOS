import type { Metadata } from "next";

import { TransactionsView } from "@/features/transactions/components/txn-view";

export const metadata: Metadata = {
  title: "Transactions · TribeOS",
};

export default function TransactionsPage() {
  return <TransactionsView />;
}

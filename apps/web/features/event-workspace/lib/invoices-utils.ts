import type { ClientInvoice } from "@/types/client-invoice";

export function invoiceCollectionSummary(invoices: readonly ClientInvoice[]) {
  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const outstanding = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.outstanding ?? invoice.total_amount),
    0,
  );
  const collected = Math.max(total - outstanding, 0);
  return { total, outstanding, collected };
}

export function filterInvoices(
  invoices: readonly ClientInvoice[],
  options: {
    query: string;
    status: ClientInvoice["status"] | "all";
  },
): ClientInvoice[] {
  const q = options.query.trim().toLowerCase();
  return invoices.filter((invoice) => {
    if (options.status !== "all" && invoice.status !== options.status) return false;
    if (!q) return true;
    return (
      invoice.invoice_number.toLowerCase().includes(q) ||
      (invoice.notes ?? "").toLowerCase().includes(q)
    );
  });
}

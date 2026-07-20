import { Button } from "@tribeos/ui";

import type { ClientInvoice } from "@/types/client-invoice";

import { ClientInvoiceStatusBadge } from "./invoice-status-badge";

interface ClientInvoiceTableProps {
  invoices: ClientInvoice[];
  eventNames: Record<string, string>;
  onOpen: (invoice: ClientInvoice) => void;
}

export function ClientInvoiceTable({ invoices, eventNames, onOpen }: ClientInvoiceTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Number</th>
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Outstanding</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-foreground">{invoice.invoice_number}</td>
              <td className="px-4 py-3 text-foreground-secondary">
                {eventNames[invoice.event_id] ?? invoice.event_id.slice(0, 8)}
              </td>
              <td className="px-4 py-3 tabular-nums">{invoice.total_amount}</td>
              <td className="px-4 py-3 tabular-nums">{invoice.outstanding ?? "—"}</td>
              <td className="px-4 py-3">
                <ClientInvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => onOpen(invoice)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

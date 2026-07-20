import type { Metadata } from "next";

import { ClientInvoicesView } from "@/features/client-invoices/components/invoices-view";

export const metadata: Metadata = {
  title: "Client Invoices · TribeOS",
};

export default function ClientInvoicesPage() {
  return <ClientInvoicesView />;
}

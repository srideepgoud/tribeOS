import type { ClientInvoice } from "@/types/client-invoice";
import type { CostCategory } from "@/types/cost-category";
import type { CostItem } from "@/types/cost-item";
import type { Event } from "@/types/event";
import type { Transaction } from "@/types/transaction";
import type { VendorWorkOrder } from "@/types/vendor-work-order";

export type TimelineEntityType =
  | "event"
  | "budget_section"
  | "budget_line"
  | "work_order"
  | "expense"
  | "invoice"
  | "receipt";

export type TimelineFilter = "all" | "budget" | "execution" | "expenses" | "invoices";

export interface TimelineEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly entityType: TimelineEntityType;
  readonly entityId: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
}

export interface BuildTimelineInput {
  readonly eventId: string;
  readonly event: Event;
  readonly categories: readonly CostCategory[];
  readonly costItems: readonly CostItem[];
  readonly workOrders: readonly VendorWorkOrder[];
  readonly transactions: readonly Transaction[];
  readonly invoices: readonly ClientInvoice[];
  readonly itemTitles: Readonly<Record<string, string>>;
  readonly vendorNames: Readonly<Record<string, string>>;
}

function wasUpdated(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

function expenseLabel(txn: Transaction): string {
  if (txn.transaction_type === "Client Receipt") return "Client receipt recorded";
  if (txn.transaction_type === "Vendor Payment") return "Vendor payment recorded";
  if (txn.transaction_type === "Internal Expense") return "Expense recorded";
  if (txn.transaction_type === "Reversal") return "Transaction reversed";
  return `${txn.transaction_type} recorded`;
}

export function buildTimelineEntries(input: BuildTimelineInput): TimelineEntry[] {
  const { eventId, event } = input;
  const entries: TimelineEntry[] = [];

  entries.push({
    id: `event-created-${event.id}`,
    timestamp: event.created_at,
    entityType: "event",
    entityId: event.id,
    title: "Event created",
    description: event.name,
    href: `/events/${eventId}/overview`,
  });

  if (wasUpdated(event.created_at, event.updated_at)) {
    entries.push({
      id: `event-updated-${event.id}`,
      timestamp: event.updated_at,
      entityType: "event",
      entityId: event.id,
      title: "Event updated",
      description: `Status: ${event.status}`,
      href: `/events/${eventId}/overview`,
    });
  }

  for (const section of input.categories) {
    if (section.archived_at) continue;
    entries.push({
      id: `section-${section.id}`,
      timestamp: section.created_at,
      entityType: "budget_section",
      entityId: section.id,
      title: "Budget section added",
      description: section.name,
      href: `/events/${eventId}/budget`,
    });
  }

  for (const line of input.costItems) {
    if (line.archived_at) continue;
    entries.push({
      id: `line-created-${line.id}`,
      timestamp: line.created_at,
      entityType: "budget_line",
      entityId: line.id,
      title: "Budget line added",
      description: `${line.title} · Planned ${line.budget_amount}`,
      href: `/events/${eventId}/budget`,
    });

    if (wasUpdated(line.created_at, line.updated_at)) {
      entries.push({
        id: `line-updated-${line.id}`,
        timestamp: line.updated_at,
        entityType: "budget_line",
        entityId: line.id,
        title: "Budget line updated",
        description: `${line.title} · ${line.status}`,
        href: `/events/${eventId}/budget`,
      });
    }
  }

  for (const order of input.workOrders) {
    const lineTitle = input.itemTitles[order.cost_item_id] ?? "Budget line";
    const vendorName = input.vendorNames[order.vendor_id] ?? "Vendor";
    entries.push({
      id: `work-order-${order.id}`,
      timestamp: order.created_at,
      entityType: "work_order",
      entityId: order.id,
      title: "Work order assigned",
      description: `${order.work_order_number} · ${vendorName} · ${lineTitle}`,
      href: `/events/${eventId}/execution`,
    });

    if (wasUpdated(order.created_at, order.updated_at)) {
      entries.push({
        id: `work-order-updated-${order.id}`,
        timestamp: order.updated_at,
        entityType: "work_order",
        entityId: order.id,
        title: "Work order updated",
        description: `${order.work_order_number} · ${order.status}`,
        href: `/events/${eventId}/execution`,
      });
    }
  }

  for (const invoice of input.invoices) {
    entries.push({
      id: `invoice-${invoice.id}`,
      timestamp: invoice.created_at,
      entityType: "invoice",
      entityId: invoice.id,
      title: "Client invoice created",
      description: `${invoice.invoice_number} · ${invoice.total_amount} · ${invoice.status}`,
      href: `/events/${eventId}/invoices`,
    });

    if (wasUpdated(invoice.created_at, invoice.updated_at)) {
      entries.push({
        id: `invoice-updated-${invoice.id}`,
        timestamp: invoice.updated_at,
        entityType: "invoice",
        entityId: invoice.id,
        title: "Client invoice updated",
      description: `${invoice.invoice_number} · ${invoice.status}`,
        href: `/events/${eventId}/invoices`,
      });
    }
  }

  for (const txn of input.transactions) {
    const lineTitle = txn.cost_item_id ? input.itemTitles[txn.cost_item_id] : null;
    const isReceipt = txn.transaction_type === "Client Receipt";
    entries.push({
      id: `txn-${txn.id}`,
      timestamp: txn.created_at,
      entityType: isReceipt ? "receipt" : "expense",
      entityId: txn.id,
      title: expenseLabel(txn),
      description: [
        txn.amount,
        txn.status,
        lineTitle ? `· ${lineTitle}` : null,
        txn.reference_number ? `· Ref ${txn.reference_number}` : null,
      ]
        .filter(Boolean)
        .join(" "),
      href: isReceipt ? `/events/${eventId}/invoices` : `/events/${eventId}/expenses`,
    });
  }

  return entries.sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

const FILTER_ENTITY_TYPES: Record<TimelineFilter, readonly TimelineEntityType[] | "all"> = {
  all: "all",
  budget: ["budget_section", "budget_line"],
  execution: ["work_order"],
  expenses: ["expense"],
  invoices: ["invoice", "receipt"],
};

export function filterTimelineEntries(
  entries: readonly TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  const allowed = FILTER_ENTITY_TYPES[filter];
  if (allowed === "all") return [...entries];
  return entries.filter((entry) => allowed.includes(entry.entityType));
}

export function formatTimelineTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

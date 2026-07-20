import type { EventStatus } from "@/types/event";

export type WorkspaceTabId =
  | "overview"
  | "budget"
  | "execution"
  | "expenses"
  | "invoices"
  | "settlement"
  | "timeline";

export interface WorkspaceTab {
  readonly id: WorkspaceTabId;
  readonly label: string;
  readonly segment: string;
  /** Minimum event status before the tab is interactive. */
  readonly availableFrom: EventStatus;
  readonly unavailableHint: string;
}

const STATUS_ORDER: readonly EventStatus[] = [
  "Draft",
  "Planning",
  "Commercials",
  "Procurement",
  "Execution",
  "Settlement",
  "Closed",
  "Cancelled",
];

export const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  {
    id: "overview",
    label: "Overview",
    segment: "overview",
    availableFrom: "Draft",
    unavailableHint: "",
  },
  {
    id: "budget",
    label: "Budget",
    segment: "budget",
    availableFrom: "Draft",
    unavailableHint: "",
  },
  {
    id: "execution",
    label: "Execution",
    segment: "execution",
    availableFrom: "Procurement",
    unavailableHint: "Available from Procurement",
  },
  {
    id: "expenses",
    label: "Expenses",
    segment: "expenses",
    availableFrom: "Execution",
    unavailableHint: "Available from Execution",
  },
  {
    id: "invoices",
    label: "Invoices",
    segment: "invoices",
    availableFrom: "Commercials",
    unavailableHint: "Available from Commercials",
  },
  {
    id: "settlement",
    label: "Settlement",
    segment: "settlement",
    availableFrom: "Settlement",
    unavailableHint: "Available from Settlement",
  },
  {
    id: "timeline",
    label: "Timeline",
    segment: "timeline",
    availableFrom: "Draft",
    unavailableHint: "",
  },
] as const;

export function workspaceTabHref(eventId: string, tab: WorkspaceTab): string {
  return `/events/${eventId}/${tab.segment}`;
}

export function statusRank(status: EventStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? 0 : index;
}

export function isTabAvailable(eventStatus: EventStatus, tab: WorkspaceTab): boolean {
  if (eventStatus === "Cancelled") {
    return tab.id === "overview" || tab.id === "timeline";
  }
  return statusRank(eventStatus) >= statusRank(tab.availableFrom);
}

export function tabFromSegment(segment: string): WorkspaceTab | undefined {
  return WORKSPACE_TABS.find((tab) => tab.segment === segment);
}

import type { EventStatus } from "@/types/event";
import { ALLOWED_TRANSITIONS } from "@/types/event";

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
  /** Minimum event status before the tab's primary workflow unlocks. */
  readonly availableFrom: EventStatus;
  readonly unavailableHint: string;
  /** Shown when the tab is opened before the lifecycle unlocks. */
  readonly gateTitle: string;
  readonly gateBody: string;
  readonly gatePrimaryHref?: "budget" | "overview" | "invoices";
  readonly gatePrimaryLabel?: string;
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
    gateTitle: "",
    gateBody: "",
  },
  {
    id: "budget",
    label: "Budget",
    segment: "budget",
    availableFrom: "Draft",
    unavailableHint: "",
    gateTitle: "",
    gateBody: "",
  },
  {
    id: "execution",
    label: "Execution",
    segment: "execution",
    availableFrom: "Procurement",
    unavailableHint: "Unlocks at Procurement",
    gateTitle: "Execution unlocks at Procurement",
    gateBody:
      "Finish planning the budget, then advance the event to Procurement so you can assign vendors and create work orders.",
    gatePrimaryHref: "budget",
    gatePrimaryLabel: "Go to Budget",
  },
  {
    id: "expenses",
    label: "Expenses",
    segment: "expenses",
    availableFrom: "Execution",
    unavailableHint: "Unlocks at Execution",
    gateTitle: "Expenses unlock at Execution",
    gateBody:
      "Cash spend is recorded once the event is in Execution. Until then, keep building the budget and assigning vendors.",
    gatePrimaryHref: "budget",
    gatePrimaryLabel: "Go to Budget",
  },
  {
    id: "invoices",
    label: "Invoices",
    segment: "invoices",
    availableFrom: "Commercials",
    unavailableHint: "Unlocks at Commercials",
    gateTitle: "Invoices unlock at Commercials",
    gateBody:
      "Client invoices are raised after commercial planning is ready. Advance the event to Commercials when the budget plan is set.",
    gatePrimaryHref: "budget",
    gatePrimaryLabel: "Go to Budget",
  },
  {
    id: "settlement",
    label: "Settlement",
    segment: "settlement",
    availableFrom: "Settlement",
    unavailableHint: "Unlocks at Settlement",
    gateTitle: "Settlement unlocks after Execution",
    gateBody:
      "Close gates and financial close appear when the event reaches Settlement. Complete execution and collections first.",
    gatePrimaryHref: "overview",
    gatePrimaryLabel: "Review Overview",
  },
  {
    id: "timeline",
    label: "Timeline",
    segment: "timeline",
    availableFrom: "Draft",
    unavailableHint: "",
    gateTitle: "",
    gateBody: "",
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

/** Next forward lifecycle step (skips Cancelled). */
export function nextLifecycleStatus(current: EventStatus): EventStatus | null {
  const next = ALLOWED_TRANSITIONS[current].find((status) => status !== "Cancelled");
  return next ?? null;
}

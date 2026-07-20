"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@tribeos/ui";

import { VendorWorkOrderFormDialog } from "@/features/vendor-work-orders/components/vwo-form-dialog";
import { formatMoney } from "@/lib/money";
import { apiErrorMessage } from "@/services/http";
import { isEventReadOnly } from "@/types/event";
import type { VendorWorkOrder, VendorWorkOrderStatus } from "@/types/vendor-work-order";
import { VENDOR_WORK_ORDER_STATUSES } from "@/types/vendor-work-order";

import { WORKSPACE_TABS, isTabAvailable } from "../../constants";
import { useExecutionData } from "../../hooks/use-execution-data";
import { executionCoverage, filterExecutionGroups } from "../../lib/execution-utils";
import { TabGatePanel } from "../tab-gate-panel";
import { WorkspaceErrorState } from "../workspace-error-state";
import { ExecutionSectionGroupBlock } from "./execution-section-group";

interface ExecutionTabProps {
  eventId: string;
}

export function ExecutionTab({ eventId }: ExecutionTabProps) {
  const { event, groups, vendorNames, isLoading, isError, error, refetch } =
    useExecutionData(eventId);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<VendorWorkOrderStatus | "all">("all");
  const [assignCostItemId, setAssignCostItemId] = useState<string | undefined>(undefined);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<VendorWorkOrder | null>(null);

  const filteredGroups = useMemo(
    () => filterExecutionGroups(groups, { search, status: statusFilter, vendorNames }),
    [groups, search, statusFilter, vendorNames],
  );

  const coverage = useMemo(() => executionCoverage(groups), [groups]);
  const canAssign = event ? !isEventReadOnly(event.status) : false;
  const hasFilters = search.trim().length > 0 || statusFilter !== "all";

  const openAssign = (costItemId: string) => {
    setAssignCostItemId(costItemId);
    setAssignOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load execution data.")}
        onRetry={refetch}
      />
    );
  }

  const executionTab = WORKSPACE_TABS.find((tab) => tab.id === "execution")!;
  if (!isTabAvailable(event.status, executionTab)) {
    return <TabGatePanel event={event} tab={executionTab} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Execution</h2>
        <p className="text-sm text-muted">
          Assign vendors to budget lines and track committed spend for this event.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Vendor coverage</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {coverage.covered} of {coverage.total} lines
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Planned (vendor lines)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(coverage.planned.toFixed(2))}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">Committed</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(coverage.committed.toFixed(2))}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lines, vendors, work orders"
            aria-label="Search execution"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as VendorWorkOrderStatus | "all")}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by work order status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {VENDOR_WORK_ORDER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No Vendor Work Orders yet</p>
          <p className="mt-1 text-sm text-muted">
            They appear once you assign a vendor from a Budget Line.
          </p>
          <Link
            href={`/events/${eventId}/budget`}
            className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Go to Budget
          </Link>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center text-sm text-muted">
          {hasFilters
            ? "No work orders match your filters."
            : "No vendor lines available for execution."}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredGroups.map((group) => (
            <ExecutionSectionGroupBlock
              key={group.section.id}
              group={group}
              vendorNames={vendorNames}
              canAssign={canAssign}
              onAssign={openAssign}
              onEditWorkOrder={setEditingWorkOrder}
            />
          ))}
        </div>
      )}

      <VendorWorkOrderFormDialog
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) setAssignCostItemId(undefined);
        }}
        defaultCostItemId={assignCostItemId}
      />
      <VendorWorkOrderFormDialog
        open={editingWorkOrder !== null}
        onOpenChange={(open) => {
          if (!open) setEditingWorkOrder(null);
        }}
        workOrder={editingWorkOrder}
      />
    </div>
  );
}

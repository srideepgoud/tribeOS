"use client";

import type { VendorWorkOrder } from "@/types/vendor-work-order";

import type { ExecutionLineGroup, ExecutionSectionGroup } from "../../lib/execution-utils";
import { ExecutionLineCard } from "./execution-line-card";

interface ExecutionSectionGroupBlockProps {
  group: ExecutionSectionGroup;
  vendorNames: Readonly<Record<string, string>>;
  canAssign: boolean;
  onAssign: (costItemId: string) => void;
  onEditWorkOrder: (workOrder: VendorWorkOrder) => void;
}

export function ExecutionSectionGroupBlock({
  group,
  vendorNames,
  canAssign,
  onAssign,
  onEditWorkOrder,
}: ExecutionSectionGroupBlockProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
        {group.section.name}
      </h3>
      <div className="flex flex-col gap-3">
        {group.lines.map((lineGroup: ExecutionLineGroup) => (
          <ExecutionLineCard
            key={lineGroup.line.id}
            lineGroup={lineGroup}
            vendorNames={vendorNames}
            canAssign={canAssign}
            onAssign={onAssign}
            onEditWorkOrder={onEditWorkOrder}
          />
        ))}
      </div>
    </section>
  );
}

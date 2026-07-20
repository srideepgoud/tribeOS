"use client";

import { useMemo, useState } from "react";
import { CopyPlus, FileSpreadsheet, Upload } from "lucide-react";
import { Button, Skeleton } from "@tribeos/ui";

import { TransactionFormDialog } from "@/features/transactions/components/txn-form-dialog";
import { VendorWorkOrderFormDialog } from "@/features/vendor-work-orders/components/vwo-form-dialog";
import { apiErrorMessage } from "@/services/http";
import type { CostItem } from "@/types/cost-item";

import { useBudgetData } from "../../hooks/use-budget-data";
import { budgetEditingMessage } from "../../lib/budget-utils";
import { WorkspaceErrorState } from "../workspace-error-state";
import { BudgetBulkPasteDialog } from "./budget-bulk-paste-dialog";
import { BudgetEmptyState } from "./budget-empty-state";
import { BudgetExcelImportDialog } from "./budget-excel-import-dialog";
import { BudgetLineDetailPanel } from "./budget-line-detail-panel";
import { BudgetTemplatesDialog } from "./budget-templates-dialog";
import { BudgetTree } from "./budget-tree";

interface BudgetTabProps {
  eventId: string;
}

export function BudgetTab({ eventId }: BudgetTabProps) {
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [bulkPasteOpen, setBulkPasteOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [assignVendorLine, setAssignVendorLine] = useState<CostItem | null>(null);
  const [recordExpenseLine, setRecordExpenseLine] = useState<CostItem | null>(null);
  const {
    event,
    sections,
    categories,
    items,
    committedByLineId,
    eventTotals,
    editable,
    isLoading,
    isError,
    error,
    refetch,
  } = useBudgetData(eventId);

  const selectedLine = useMemo(
    () => items.find((item) => item.id === selectedLineId) ?? null,
    [items, selectedLineId],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <WorkspaceErrorState
        message={apiErrorMessage(error, "Could not load the event budget.")}
        onRetry={refetch}
      />
    );
  }

  const editingMessage = budgetEditingMessage(event.status);
  const hasSections = sections.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Budget</h2>
          <p className="text-sm text-muted">
            Build sections and lines inline — like a spreadsheet. Click a line to open its detail
            panel for vendors and expenses.
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              <CopyPlus />
              Templates
            </Button>
            <Button variant="outline" onClick={() => setBulkPasteOpen(true)}>
              <Upload />
              Bulk paste
            </Button>
            <Button variant="outline" onClick={() => setExcelImportOpen(true)}>
              <FileSpreadsheet />
              Import Excel
            </Button>
          </div>
        ) : null}
      </div>

      {editingMessage ? (
        <div className="rounded-lg border border-border bg-background-secondary px-4 py-3 text-sm text-muted">
          {editingMessage}
        </div>
      ) : null}

      {!hasSections && editable ? (
        <BudgetEmptyState message="Start with a budget section (e.g. Production), then add lines underneath it. Event context is already set — no dialogs needed." />
      ) : null}

      {!hasSections && !editable ? (
        <BudgetEmptyState message={editingMessage ?? "No budget sections yet."} />
      ) : null}

      {hasSections || editable ? (
        <BudgetTree
          eventId={eventId}
          sections={sections}
          categories={categories}
          committedByLineId={committedByLineId}
          eventTotals={eventTotals}
          editable={editable}
          selectedLineId={selectedLineId}
          onOpenLine={(line) => setSelectedLineId(line.id)}
          onAssignVendor={(line) => setAssignVendorLine(line)}
          onRecordExpense={(line) => setRecordExpenseLine(line)}
        />
      ) : null}

      <BudgetLineDetailPanel
        line={selectedLine}
        eventId={eventId}
        eventStatus={event.status}
        open={selectedLine !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLineId(null);
        }}
      />

      <VendorWorkOrderFormDialog
        open={Boolean(assignVendorLine)}
        onOpenChange={(open) => {
          if (!open) setAssignVendorLine(null);
        }}
        defaultCostItemId={assignVendorLine?.id}
      />
      <TransactionFormDialog
        open={Boolean(recordExpenseLine)}
        onOpenChange={(open) => {
          if (!open) setRecordExpenseLine(null);
        }}
        defaultEventId={eventId}
        defaultCostItemId={recordExpenseLine?.id}
        defaultTransactionType="Vendor Payment"
      />

      <BudgetBulkPasteDialog
        eventId={eventId}
        categories={categories}
        open={bulkPasteOpen}
        onOpenChange={setBulkPasteOpen}
      />
      <BudgetTemplatesDialog
        eventId={eventId}
        sections={sections}
        categories={categories}
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
      />
      <BudgetExcelImportDialog
        eventId={eventId}
        categories={categories}
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
      />
    </div>
  );
}

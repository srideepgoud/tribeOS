"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tribeos/ui";

import { useCreateCostCategory } from "@/features/cost-categories/hooks";
import { useCreateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { nextSectionDisplayOrder } from "../../lib/budget-utils";
import {
  buildImportPreview,
  isSupportedBudgetImportFile,
  mappingIsComplete,
  parseSpreadsheetMatrix,
  suggestColumnMapping,
  type ColumnMapping,
  type ParsedSpreadsheet,
} from "../../lib/excel-import-utils";

type ImportStep = "upload" | "map" | "preview";

interface BudgetExcelImportDialogProps {
  eventId: string;
  categories: readonly CostCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_MAPPING: ColumnMapping = { section: null, line: null, amount: null };

export function BudgetExcelImportDialog({
  eventId,
  categories,
  open,
  onOpenChange,
}: BudgetExcelImportDialogProps) {
  const createCategory = useCreateCostCategory();
  const createItem = useCreateCostItem();
  const [step, setStep] = useState<ImportStep>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [sheet, setSheet] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => (sheet ? buildImportPreview(sheet.rows, mapping) : null),
    [sheet, mapping],
  );

  const reset = () => {
    setStep("upload");
    setFileName("");
    setSheet(null);
    setMapping(EMPTY_MAPPING);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onFileSelected = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!isSupportedBudgetImportFile(file)) {
      setError("Upload a CSV or TSV exported from Excel (File → Save As → CSV).");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseSpreadsheetMatrix(text);
      if (parsed.rows.length === 0) {
        setError("The file has no data rows.");
        return;
      }
      setFileName(file.name);
      setSheet(parsed);
      setMapping(suggestColumnMapping(parsed.headers));
      setStep("map");
    } catch {
      setError("Could not read that file.");
    }
  };

  const onImport = async () => {
    if (!preview || preview.errors.length > 0 || preview.lineCount === 0) return;
    setError(null);
    try {
      const categoryByName = new Map<string, CostCategory>(
        categories
          .filter((row) => !row.archived_at)
          .map((row) => [row.name.trim().toLowerCase(), row] as const),
      );
      let displayOrder = nextSectionDisplayOrder(categories);

      for (const section of preview.sections) {
        const normalized = section.name.trim().toLowerCase();
        let categoryId = categoryByName.get(normalized)?.id;
        if (!categoryId) {
          const created = await createCategory.mutateAsync({
            event_id: eventId,
            name: section.name,
            display_order: displayOrder,
          });
          categoryId = created.id;
          categoryByName.set(normalized, created);
          displayOrder += 1;
        }

        for (const line of section.lines) {
          await createItem.mutateAsync({
            event_id: eventId,
            category_id: categoryId,
            title: line.title,
            expense_type: "Vendor",
            budget_amount: line.budgetAmount,
            vendor_required: true,
          });
        }
      }

      handleOpenChange(false);
    } catch (importError) {
      setError(apiErrorMessage(importError, "Could not import budget rows."));
    }
  };

  const canContinueToPreview = mappingIsComplete(mapping);
  const canImport =
    Boolean(preview) &&
    preview!.errors.length === 0 &&
    preview!.lineCount > 0 &&
    !createItem.isPending &&
    !createCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Upload a CSV/TSV exported from Excel, map columns, preview validation, then create
            budget sections and lines.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            Step {step === "upload" ? "1" : step === "map" ? "2" : "3"} of 3 —{" "}
            {step === "upload" ? "Upload" : step === "map" ? "Map columns" : "Preview & import"}
          </p>

          {step === "upload" ? (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-4 py-6">
              <Label htmlFor="budget-import-file">Excel export (.csv / .tsv)</Label>
              <Input
                id="budget-import-file"
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                onChange={(event) => void onFileSelected(event.target.files?.[0])}
              />
              <p className="text-xs text-muted">
                In Excel: File → Save As → CSV UTF-8. Binary .xlsx is not parsed yet — use CSV or
                Bulk paste.
              </p>
            </div>
          ) : null}

          {step === "map" && sheet ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                File: <span className="text-foreground">{fileName}</span>
                {sheet.hasHeaderRow ? " · header row detected" : " · no header row detected"}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <ColumnSelect
                  label="Budget section"
                  headers={sheet.headers}
                  value={mapping.section}
                  onChange={(value) => setMapping((current) => ({ ...current, section: value }))}
                />
                <ColumnSelect
                  label="Budget line"
                  headers={sheet.headers}
                  value={mapping.line}
                  onChange={(value) => setMapping((current) => ({ ...current, line: value }))}
                />
                <ColumnSelect
                  label="Planned amount"
                  headers={sheet.headers}
                  value={mapping.amount}
                  onChange={(value) => setMapping((current) => ({ ...current, amount: value }))}
                />
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead className="border-b border-border bg-muted/30 text-muted">
                    <tr>
                      {sheet.headers.map((header) => (
                        <th key={header} className="px-3 py-2 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheet.rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        {sheet.headers.map((_, colIndex) => (
                          <td key={colIndex} className="px-3 py-2 text-foreground-secondary">
                            {row[colIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {step === "preview" && preview ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-muted">
                {preview.rowCount} data row(s) · {preview.sections.length} section(s) ·{" "}
                {preview.lineCount} line(s)
              </div>
              {preview.errors.length > 0 ? (
                <div className="max-h-32 overflow-auto rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {preview.errors.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              ) : (
                <ul className="max-h-48 overflow-auto divide-y divide-border rounded-md border border-border text-sm">
                  {preview.sections.map((section) => (
                    <li key={section.name} className="px-3 py-2">
                      <p className="font-medium text-foreground">{section.name}</p>
                      <p className="text-xs text-muted">
                        {section.lines.length} line{section.lines.length === 1 ? "" : "s"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {step === "map" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={!canContinueToPreview}
                onClick={() => setStep("preview")}
              >
                Preview
              </Button>
            </>
          ) : null}
          {step === "preview" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button type="button" disabled={!canImport} onClick={() => void onImport()}>
                Import {preview && preview.lineCount > 0 ? `${preview.lineCount} lines` : ""}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColumnSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: readonly string[];
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select
        value={value === null ? undefined : String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {headers.map((header, index) => (
            <SelectItem key={`${header}-${index}`} value={String(index)}>
              {header}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

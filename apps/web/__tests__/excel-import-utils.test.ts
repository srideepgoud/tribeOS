import { describe, expect, it } from "vitest";

import {
  buildImportPreview,
  parseDelimitedText,
  parseSpreadsheetMatrix,
  suggestColumnMapping,
} from "@/features/event-workspace/lib/excel-import-utils";

describe("excel import utils", () => {
  it("parses quoted CSV cells and detects headers", () => {
    const text = 'Section,Budget Line,Planned Amount\nProduction,"Stage, Build",120000\n,Sound,45000';
    const matrix = parseDelimitedText(text);
    expect(matrix).toHaveLength(3);
    expect(matrix[1]?.[1]).toBe("Stage, Build");

    const sheet = parseSpreadsheetMatrix(text);
    expect(sheet.hasHeaderRow).toBe(true);
    expect(sheet.headers).toEqual(["Section", "Budget Line", "Planned Amount"]);
    expect(sheet.rows).toHaveLength(2);
  });

  it("suggests column mapping from aliases", () => {
    const mapping = suggestColumnMapping(["Category", "Item", "Budget"]);
    expect(mapping).toEqual({ section: 0, line: 1, amount: 2 });
  });

  it("builds a validated import preview from mapped rows", () => {
    const sheet = parseSpreadsheetMatrix(
      "Category,Item,Budget\nProduction,Stage,1000\n,Sound,bad\nF&B,Catering,2000",
    );
    const mapping = suggestColumnMapping(sheet.headers);
    const preview = buildImportPreview(sheet.rows, mapping);

    expect(preview.errors).toHaveLength(1);
    expect(preview.errors[0]).toContain("Row 2");
    expect(preview.sections).toHaveLength(2);
    expect(preview.lineCount).toBe(2);
    expect(preview.sections[0]?.lines[0]?.budgetAmount).toBe("1000.00");
  });
});

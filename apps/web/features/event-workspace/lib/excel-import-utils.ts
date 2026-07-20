import { parseBudgetAmount } from "./budget-utils";
import type { ParsedBudgetSectionInput } from "./bulk-paste-utils";

export type BudgetImportField = "section" | "line" | "amount" | "skip";

export interface ColumnMapping {
  readonly section: number | null;
  readonly line: number | null;
  readonly amount: number | null;
}

export interface ParsedSpreadsheet {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly hasHeaderRow: boolean;
}

export interface BudgetImportPreview {
  readonly sections: readonly ParsedBudgetSectionInput[];
  readonly errors: readonly string[];
  readonly rowCount: number;
  readonly lineCount: number;
}

const HEADER_ALIASES: Record<BudgetImportField, readonly string[]> = {
  section: ["section", "budget section", "category", "cost category", "group"],
  line: ["line", "budget line", "item", "title", "cost item", "description", "name"],
  amount: ["amount", "planned", "budget", "budget amount", "planned amount", "cost"],
  skip: [],
};

/** Minimal CSV/TSV parser that respects quoted fields. */
export function parseDelimitedText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, "");
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.split(";").length > firstLine.split(",").length
      ? ";"
      : ",";

  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]!;
    const next = normalized[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (char === "\n") {
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    if (char === "\r") continue;
    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function looksLikeHeader(cells: readonly string[]): boolean {
  const joined = cells.map((cell) => cell.toLowerCase());
  return joined.some((cell) =>
    [...HEADER_ALIASES.section, ...HEADER_ALIASES.line, ...HEADER_ALIASES.amount].includes(cell),
  );
}

export function parseSpreadsheetMatrix(text: string): ParsedSpreadsheet {
  const matrix = parseDelimitedText(text);
  if (matrix.length === 0) {
    return { headers: [], rows: [], hasHeaderRow: false };
  }

  const first = matrix[0]!;
  const hasHeaderRow = looksLikeHeader(first);
  if (hasHeaderRow) {
    return {
      headers: first,
      rows: matrix.slice(1),
      hasHeaderRow: true,
    };
  }

  const columnCount = Math.max(...matrix.map((row) => row.length));
  return {
    headers: Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`),
    rows: matrix,
    hasHeaderRow: false,
  };
}

function matchField(header: string): BudgetImportField | null {
  const normalized = header.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    BudgetImportField,
    readonly string[],
  ][]) {
    if (field === "skip") continue;
    if (aliases.includes(normalized)) return field;
  }
  return null;
}

export function suggestColumnMapping(headers: readonly string[]): ColumnMapping {
  const mapping: { section: number | null; line: number | null; amount: number | null } = {
    section: null,
    line: null,
    amount: null,
  };

  headers.forEach((header, index) => {
    const field = matchField(header);
    if (!field || field === "skip") return;
    if (mapping[field] === null) mapping[field] = index;
  });

  if (mapping.section === null && headers.length >= 1) mapping.section = 0;
  if (mapping.line === null && headers.length >= 2) mapping.line = 1;
  if (mapping.amount === null && headers.length >= 3) mapping.amount = 2;

  return mapping;
}

export function mappingIsComplete(mapping: ColumnMapping): boolean {
  return mapping.section !== null && mapping.line !== null && mapping.amount !== null;
}

export function buildImportPreview(
  rows: readonly (readonly string[])[],
  mapping: ColumnMapping,
): BudgetImportPreview {
  const errors: string[] = [];
  const sections: ParsedBudgetSectionInput[] = [];
  const sectionIndexByName = new Map<string, number>();
  let currentSectionName = "";

  if (!mappingIsComplete(mapping)) {
    return {
      sections: [],
      errors: ["Map Section, Budget Line, and Planned Amount columns before importing."],
      rowCount: rows.length,
      lineCount: 0,
    };
  }

  const sectionIdx = mapping.section!;
  const lineIdx = mapping.line!;
  const amountIdx = mapping.amount!;

  rows.forEach((row, index) => {
    const sectionCell = (row[sectionIdx] ?? "").trim();
    const lineCell = (row[lineIdx] ?? "").trim();
    const amountCell = (row[amountIdx] ?? "").trim();

    if (!sectionCell && !lineCell && !amountCell) return;

    const sectionName = sectionCell || currentSectionName;
    if (!sectionName) {
      errors.push(`Row ${index + 1}: missing section name.`);
      return;
    }
    currentSectionName = sectionName;

    const key = sectionName.toLowerCase();
    let targetIndex = sectionIndexByName.get(key);
    if (targetIndex === undefined) {
      targetIndex = sections.length;
      sectionIndexByName.set(key, targetIndex);
      sections.push({ name: sectionName, lines: [] });
    }

    if (!lineCell && !amountCell) return;
    if (!lineCell) {
      errors.push(`Row ${index + 1}: missing budget line title.`);
      return;
    }

    const amount = parseBudgetAmount(amountCell);
    if (!amount) {
      errors.push(`Row ${index + 1}: invalid planned amount "${amountCell || "(empty)"}".`);
      return;
    }

    const target = sections[targetIndex]!;
    sections[targetIndex] = {
      ...target,
      lines: [...target.lines, { title: lineCell, budgetAmount: amount }],
    };
  });

  return {
    sections,
    errors,
    rowCount: rows.length,
    lineCount: sections.reduce((sum, section) => sum + section.lines.length, 0),
  };
}

export function isSupportedBudgetImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt");
}

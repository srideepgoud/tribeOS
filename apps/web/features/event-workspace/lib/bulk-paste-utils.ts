import { parseBudgetAmount } from "./budget-utils";

export interface ParsedBudgetLineInput {
  readonly title: string;
  readonly budgetAmount: string;
}

export interface ParsedBudgetSectionInput {
  readonly name: string;
  readonly lines: readonly ParsedBudgetLineInput[];
}

export interface BulkPasteParseResult {
  readonly sections: readonly ParsedBudgetSectionInput[];
  readonly errors: readonly string[];
  readonly rowCount: number;
}

function splitRow(raw: string): string[] {
  if (raw.includes("\t")) return raw.split("\t");
  return raw.split(",");
}

function normalize(value: string): string {
  return value.trim();
}

export function parseBudgetBulkPaste(input: string): BulkPasteParseResult {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const errors: string[] = [];
  const sections: ParsedBudgetSectionInput[] = [];
  const sectionIndexByName = new Map<string, number>();
  let currentSectionName = "";

  rows.forEach((row, idx) => {
    const columns = splitRow(row).map(normalize);
    const first = columns[0] ?? "";
    const second = columns[1] ?? "";
    const third = columns[2] ?? "";

    if (!first && !second && !third) return;

    const sectionName = first || currentSectionName;
    if (!sectionName) {
      errors.push(`Row ${idx + 1}: missing section name.`);
      return;
    }
    currentSectionName = sectionName;

    const key = sectionName.toLowerCase();
    let sectionIdx = sectionIndexByName.get(key);
    if (sectionIdx === undefined) {
      sectionIdx = sections.length;
      sectionIndexByName.set(key, sectionIdx);
      sections.push({ name: sectionName, lines: [] });
    }

    if (!second && !third) return;
    if (!second) {
      errors.push(`Row ${idx + 1}: missing budget line title.`);
      return;
    }
    const amount = parseBudgetAmount(third);
    if (!amount) {
      errors.push(`Row ${idx + 1}: invalid planned amount "${third || "(empty)"}".`);
      return;
    }

    const target = sections[sectionIdx];
    sections[sectionIdx] = {
      ...target,
      lines: [...target.lines, { title: second, budgetAmount: amount }],
    };
  });

  return {
    sections,
    errors,
    rowCount: rows.length,
  };
}

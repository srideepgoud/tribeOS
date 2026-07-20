import { describe, expect, it } from "vitest";

import { parseBudgetBulkPaste } from "@/features/event-workspace/lib/bulk-paste-utils";

describe("bulk paste parser", () => {
  it("parses sections and lines from tabular rows", () => {
    const result = parseBudgetBulkPaste(
      "Production\tStage Build\t120000\n\tSound Rental\t45000\nF&B\tCatering\t90000",
    );

    expect(result.errors).toHaveLength(0);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.name).toBe("Production");
    expect(result.sections[0]?.lines).toHaveLength(2);
    expect(result.sections[1]?.lines[0]?.budgetAmount).toBe("90000.00");
  });

  it("reports invalid rows", () => {
    const result = parseBudgetBulkPaste("\tStage Build\t1000\nProduction\t\t2000");
    expect(result.errors).toHaveLength(2);
  });
});

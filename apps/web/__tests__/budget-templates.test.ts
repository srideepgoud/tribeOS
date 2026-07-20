import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTemplateSections,
  deleteBudgetTemplate,
  listBudgetTemplates,
  saveBudgetTemplate,
} from "@/features/event-workspace/lib/budget-templates";
import type { BudgetSectionGroup } from "@/features/event-workspace/lib/budget-utils";

describe("budget templates", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("template-1");
  });

  it("serializes budget sections into template shape", () => {
    const sections = [
      {
        section: { id: "sec-1", name: "Production" },
        lines: [
          { id: "line-1", title: "Stage", budget_amount: "1000.00" },
          { id: "line-2", title: "Sound", budget_amount: "2000.00" },
        ],
        totals: { planned: 3000, committed: 0, actual: 0, variance: 3000 },
      },
    ] as unknown as BudgetSectionGroup[];

    const result = buildTemplateSections(sections);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Production");
    expect(result[0]?.lines).toHaveLength(2);
  });

  it("saves and deletes templates in local storage", () => {
    saveBudgetTemplate("Wedding Base", [
      {
        name: "Production",
        lines: [{ title: "Stage", budgetAmount: "1000.00" }],
      },
    ]);

    let templates = listBudgetTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]?.id).toBe("template-1");

    templates = deleteBudgetTemplate("template-1");
    expect(templates).toHaveLength(0);
  });
});

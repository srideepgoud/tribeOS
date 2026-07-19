import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { CostItemCreateInput, ExpenseType } from "@/types/cost-item";
import { EXPENSE_TYPES } from "@/types/cost-item";

export const costItemFormSchema = z
  .object({
    event_id: z.string().uuid("Select an event"),
    category_id: z.string().uuid("Select a cost category"),
    title: z.string().trim().min(1, "Title is required").max(255),
    description: z.string().trim().optional().or(z.literal("")),
    expense_type: z.enum(EXPENSE_TYPES),
    budget_amount: z.string().trim().min(1, "Budget amount is required"),
    negotiated_amount: z.string().trim().optional().or(z.literal("")),
    vendor_required: z.boolean(),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    const budget = Number(values.budget_amount);
    if (Number.isNaN(budget) || budget < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid non-negative amount",
        path: ["budget_amount"],
      });
    }
    if (values.negotiated_amount && values.negotiated_amount.trim() !== "") {
      const negotiated = Number(values.negotiated_amount);
      if (Number.isNaN(negotiated) || negotiated < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid non-negative amount",
          path: ["negotiated_amount"],
        });
      }
    }
    if (values.expense_type === "Internal" && values.vendor_required) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal expenses never require a vendor",
        path: ["vendor_required"],
      });
    }
  });

export type CostItemFormValues = z.infer<typeof costItemFormSchema>;

export const emptyCostItemForm: CostItemFormValues = {
  event_id: "",
  category_id: "",
  title: "",
  description: "",
  expense_type: "Vendor" as ExpenseType,
  budget_amount: "",
  negotiated_amount: "",
  vendor_required: false,
  notes: "",
};

export function toCostItemPayload(values: CostItemFormValues): CostItemCreateInput {
  return {
    event_id: values.event_id,
    category_id: values.category_id,
    title: values.title.trim(),
    description: emptyToNull(values.description),
    expense_type: values.expense_type,
    budget_amount: values.budget_amount.trim(),
    negotiated_amount: emptyToNull(values.negotiated_amount),
    vendor_required: values.vendor_required,
    notes: emptyToNull(values.notes),
  };
}

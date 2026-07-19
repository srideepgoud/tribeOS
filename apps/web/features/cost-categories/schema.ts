import { z } from "zod";

import type { CostCategoryCreateInput } from "@/types/cost-category";

export const costCategoryFormSchema = z.object({
  event_id: z.string().uuid("Select an event"),
  name: z.string().trim().min(1, "Category name is required").max(255),
  display_order: z.coerce.number().int().min(0, "Display order must be 0 or greater"),
});

export type CostCategoryFormValues = z.infer<typeof costCategoryFormSchema>;

export const emptyCostCategoryForm: CostCategoryFormValues = {
  event_id: "",
  name: "",
  display_order: 0,
};

export function toCostCategoryPayload(values: CostCategoryFormValues): CostCategoryCreateInput {
  return {
    event_id: values.event_id,
    name: values.name.trim(),
    display_order: values.display_order,
  };
}

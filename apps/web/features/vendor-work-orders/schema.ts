import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { VendorWorkOrderCreateInput } from "@/types/vendor-work-order";

export const vendorWorkOrderFormSchema = z.object({
  cost_item_id: z.string().uuid("Select a Cost Item"),
  vendor_id: z.string().uuid("Select a Vendor"),
  scope: z.string().trim().optional().or(z.literal("")),
  agreed_amount: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || !Number.isNaN(Number(value)), "Enter a valid amount"),
  issue_date: z.string().trim().optional().or(z.literal("")),
  expected_completion: z.string().trim().optional().or(z.literal("")),
});

export type VendorWorkOrderFormValues = z.infer<typeof vendorWorkOrderFormSchema>;

export const emptyVendorWorkOrderForm: VendorWorkOrderFormValues = {
  cost_item_id: "",
  vendor_id: "",
  scope: "",
  agreed_amount: "",
  issue_date: "",
  expected_completion: "",
};

export function toVendorWorkOrderPayload(
  values: VendorWorkOrderFormValues,
): VendorWorkOrderCreateInput {
  return {
    cost_item_id: values.cost_item_id,
    vendor_id: values.vendor_id,
    scope: emptyToNull(values.scope),
    agreed_amount: emptyToNull(values.agreed_amount),
    issue_date: emptyToNull(values.issue_date),
    expected_completion: emptyToNull(values.expected_completion),
  };
}

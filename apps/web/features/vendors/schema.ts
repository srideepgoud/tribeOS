import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { VendorCreateInput } from "@/types/vendor";

// Mirrors backend validation (business_rules.md: company name mandatory).
export const vendorFormSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(255),
  contact_name: z.string().trim().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  gst_number: z.string().trim().max(32).optional().or(z.literal("")),
  pan_number: z.string().trim().max(32).optional().or(z.literal("")),
  bank_name: z.string().trim().max(255).optional().or(z.literal("")),
  account_number: z.string().trim().max(64).optional().or(z.literal("")),
  ifsc: z.string().trim().max(32).optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type VendorFormValues = z.infer<typeof vendorFormSchema>;

export const emptyVendorForm: VendorFormValues = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  gst_number: "",
  pan_number: "",
  bank_name: "",
  account_number: "",
  ifsc: "",
  notes: "",
};

/** Convert form values to an API payload: blank optional strings become null. */
export function toVendorPayload(values: VendorFormValues): VendorCreateInput {
  return {
    company_name: values.company_name.trim(),
    contact_name: emptyToNull(values.contact_name),
    phone: emptyToNull(values.phone),
    email: emptyToNull(values.email),
    gst_number: emptyToNull(values.gst_number),
    pan_number: emptyToNull(values.pan_number),
    bank_name: emptyToNull(values.bank_name),
    account_number: emptyToNull(values.account_number),
    ifsc: emptyToNull(values.ifsc),
    notes: emptyToNull(values.notes),
  };
}

import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { ClientCreateInput } from "@/types/client";

// Mirrors backend validation (business_rules.md: company name mandatory). The
// backend remains the source of truth; this improves UX only.
export const clientFormSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(255),
  gst_number: z.string().trim().max(32).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  billing_address: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const emptyClientForm: ClientFormValues = {
  company_name: "",
  gst_number: "",
  phone: "",
  email: "",
  billing_address: "",
  notes: "",
};

/** Convert form values to an API payload: blank optional strings become null. */
export function toClientPayload(values: ClientFormValues): ClientCreateInput {
  return {
    company_name: values.company_name.trim(),
    gst_number: emptyToNull(values.gst_number),
    phone: emptyToNull(values.phone),
    email: emptyToNull(values.email),
    billing_address: emptyToNull(values.billing_address),
    notes: emptyToNull(values.notes),
  };
}

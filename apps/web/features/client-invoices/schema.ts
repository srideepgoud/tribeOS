import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { ClientInvoiceCreateInput } from "@/types/client-invoice";

export const clientInvoiceFormSchema = z.object({
  event_id: z.string().uuid("Select an Event"),
  client_id: z.string().uuid("Client is required"),
  invoice_date: z.string().trim().min(1, "Invoice date is required"),
  due_date: z.string().trim().optional().or(z.literal("")),
  amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, "Enter an amount ≥ 0"),
  gst_amount: z
    .string()
    .trim()
    .min(1, "GST is required")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, "Enter GST ≥ 0"),
  total_amount: z
    .string()
    .trim()
    .min(1, "Total is required")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, "Enter total ≥ 0"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type ClientInvoiceFormValues = z.infer<typeof clientInvoiceFormSchema>;

export const emptyClientInvoiceForm: ClientInvoiceFormValues = {
  event_id: "",
  client_id: "",
  invoice_date: "",
  due_date: "",
  amount: "",
  gst_amount: "0.00",
  total_amount: "",
  notes: "",
};

export function toClientInvoicePayload(values: ClientInvoiceFormValues): ClientInvoiceCreateInput {
  return {
    event_id: values.event_id,
    client_id: values.client_id,
    invoice_date: values.invoice_date,
    due_date: emptyToNull(values.due_date),
    amount: values.amount.trim(),
    gst_amount: values.gst_amount.trim(),
    total_amount: values.total_amount.trim(),
    notes: emptyToNull(values.notes),
  };
}

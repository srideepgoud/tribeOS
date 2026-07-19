import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { TransactionCreateInput } from "@/types/transaction";
import { PAYMENT_METHODS, PHASE7_CREATE_TYPES } from "@/types/transaction";

export const transactionFormSchema = z
  .object({
    event_id: z.string().uuid("Select an Event"),
    cost_item_id: z.string().uuid("Select a Cost Item"),
    work_order_id: z.string().uuid().optional().or(z.literal("")),
    transaction_type: z.enum(PHASE7_CREATE_TYPES),
    payment_method: z.enum(PAYMENT_METHODS),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required")
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, "Enter an amount > 0"),
    transaction_date: z.string().trim().min(1, "Date is required"),
    reference_number: z.string().trim().max(128).optional().or(z.literal("")),
    remarks: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    if (values.transaction_type === "Vendor Payment" && !values.work_order_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vendor Payment requires a Work Order",
        path: ["work_order_id"],
      });
    }
    if (values.transaction_type === "Internal Expense" && values.work_order_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Internal Expense must not reference a Work Order",
        path: ["work_order_id"],
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const emptyTransactionForm: TransactionFormValues = {
  event_id: "",
  cost_item_id: "",
  work_order_id: "",
  transaction_type: "Internal Expense",
  payment_method: "Bank Transfer",
  amount: "",
  transaction_date: "",
  reference_number: "",
  remarks: "",
};

export function toTransactionPayload(values: TransactionFormValues): TransactionCreateInput {
  return {
    event_id: values.event_id,
    cost_item_id: values.cost_item_id,
    work_order_id:
      values.transaction_type === "Vendor Payment" ? emptyToNull(values.work_order_id) : null,
    transaction_type: values.transaction_type,
    payment_method: values.payment_method,
    amount: values.amount.trim(),
    transaction_date: values.transaction_date,
    reference_number: emptyToNull(values.reference_number),
    remarks: emptyToNull(values.remarks),
  };
}

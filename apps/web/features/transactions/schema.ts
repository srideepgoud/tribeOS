import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { TransactionCreateInput } from "@/types/transaction";
import { PAYMENT_METHODS, PHASE9_CREATE_TYPES } from "@/types/transaction";

const allocationLineSchema = z.object({
  cost_item_id: z.string().uuid("Select a Cost Item"),
  allocated_amount: z
    .string()
    .trim()
    .min(1, "Amount is required")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, "Enter an amount > 0"),
});

export const transactionFormSchema = z
  .object({
    event_id: z.string().uuid("Select an Event"),
    cost_item_id: z.string().uuid().optional().or(z.literal("")),
    work_order_id: z.string().uuid().optional().or(z.literal("")),
    client_invoice_id: z.string().uuid().optional().or(z.literal("")),
    transaction_type: z.enum(PHASE9_CREATE_TYPES),
    payment_method: z.enum(PAYMENT_METHODS),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required")
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, "Enter an amount > 0"),
    transaction_date: z.string().trim().min(1, "Date is required"),
    reference_number: z.string().trim().max(128).optional().or(z.literal("")),
    remarks: z.string().trim().optional().or(z.literal("")),
    use_shared_allocations: z.boolean(),
    allocations: z.array(allocationLineSchema),
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
    if (values.transaction_type === "Client Receipt") {
      if (!values.client_invoice_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Client Receipt requires a Client Invoice",
          path: ["client_invoice_id"],
        });
      }
      return;
    }

    if (values.use_shared_allocations) {
      if (values.allocations.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Add at least one allocation line",
          path: ["allocations"],
        });
      }
      const ids = values.allocations.map((line) => line.cost_item_id);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate Cost Items are not allowed",
          path: ["allocations"],
        });
      }
      const total = values.allocations.reduce((sum, line) => sum + Number(line.allocated_amount), 0);
      const amount = Number(values.amount);
      if (!Number.isNaN(total) && !Number.isNaN(amount) && total > amount + 1e-9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allocation total cannot exceed Transaction amount",
          path: ["allocations"],
        });
      }
    } else if (!values.cost_item_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a Cost Item (or enable shared allocations)",
        path: ["cost_item_id"],
      });
    }
  });

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

export const emptyTransactionForm: TransactionFormValues = {
  event_id: "",
  cost_item_id: "",
  work_order_id: "",
  client_invoice_id: "",
  transaction_type: "Internal Expense",
  payment_method: "Bank Transfer",
  amount: "",
  transaction_date: "",
  reference_number: "",
  remarks: "",
  use_shared_allocations: false,
  allocations: [],
};

export function toTransactionPayload(values: TransactionFormValues): TransactionCreateInput {
  if (values.transaction_type === "Client Receipt") {
    return {
      event_id: values.event_id,
      client_invoice_id: emptyToNull(values.client_invoice_id),
      cost_item_id: null,
      work_order_id: null,
      transaction_type: "Client Receipt",
      payment_method: values.payment_method,
      amount: values.amount.trim(),
      transaction_date: values.transaction_date,
      reference_number: emptyToNull(values.reference_number),
      remarks: emptyToNull(values.remarks),
      allocations: null,
    };
  }

  const shared = values.use_shared_allocations && values.allocations.length > 0;
  return {
    event_id: values.event_id,
    cost_item_id: shared ? null : emptyToNull(values.cost_item_id),
    work_order_id:
      values.transaction_type === "Vendor Payment" ? emptyToNull(values.work_order_id) : null,
    client_invoice_id: null,
    transaction_type: values.transaction_type,
    payment_method: values.payment_method,
    amount: values.amount.trim(),
    transaction_date: values.transaction_date,
    reference_number: emptyToNull(values.reference_number),
    remarks: emptyToNull(values.remarks),
    allocations: shared
      ? values.allocations.map((line) => ({
          cost_item_id: line.cost_item_id,
          allocated_amount: line.allocated_amount.trim(),
        }))
      : null,
  };
}

export function allocationTotals(values: Pick<TransactionFormValues, "amount" | "allocations">): {
  allocated: number;
  remaining: number;
} {
  const amount = Number(values.amount) || 0;
  const allocated = values.allocations.reduce(
    (sum, line) => sum + (Number(line.allocated_amount) || 0),
    0,
  );
  return { allocated, remaining: Math.max(amount - allocated, 0) };
}

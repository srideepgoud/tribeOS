"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@tribeos/ui";

import { useCostItems } from "@/features/cost-items/hooks";
import { useEvents } from "@/features/events/hooks";
import { useVendorWorkOrders } from "@/features/vendor-work-orders/hooks";
import { apiErrorMessage } from "@/services/http";
import type { Transaction, TransactionStatus } from "@/types/transaction";
import {
  ALLOWED_TRANSACTION_TRANSITIONS,
  isPendingEditable,
  PAYMENT_METHODS,
  PHASE7_CREATE_TYPES,
} from "@/types/transaction";

import { useCreateTransaction, useUpdateTransaction } from "../hooks";
import {
  emptyTransactionForm,
  toTransactionPayload,
  transactionFormSchema,
  type TransactionFormValues,
} from "../schema";

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

function toFormValues(txn: Transaction): TransactionFormValues {
  return {
    event_id: txn.event_id,
    cost_item_id: txn.cost_item_id ?? "",
    work_order_id: txn.work_order_id ?? "",
    transaction_type:
      txn.transaction_type === "Vendor Payment" ? "Vendor Payment" : "Internal Expense",
    payment_method: txn.payment_method,
    amount: txn.amount,
    transaction_date: txn.transaction_date,
    reference_number: txn.reference_number ?? "",
    remarks: txn.remarks ?? "",
  };
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionFormDialogProps) {
  const isEdit = Boolean(transaction);
  const pendingEditable = transaction ? isPendingEditable(transaction.status) : true;
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const activeMutation = isEdit ? updateTxn : createTxn;
  const [pendingStatus, setPendingStatus] = useState<TransactionStatus | "">("");

  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const costItemsQuery = useCostItems({ page: 1, page_size: 100, sort: "title" });
  const workOrdersQuery = useVendorWorkOrders({ page: 1, page_size: 100, sort: "-created_at" });

  const events = eventsQuery.data?.data ?? [];
  const costItems = costItemsQuery.data?.data ?? [];
  const workOrders = workOrdersQuery.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: emptyTransactionForm,
  });

  const txnType = watch("transaction_type");
  const costItemId = watch("cost_item_id");

  const filteredWorkOrders = useMemo(
    () =>
      costItemId ? workOrders.filter((wo) => wo.cost_item_id === costItemId) : workOrders,
    [workOrders, costItemId],
  );

  useEffect(() => {
    if (!open) return;
    reset(transaction ? toFormValues(transaction) : emptyTransactionForm);
    setPendingStatus("");
    createTxn.reset();
    updateTxn.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction]);

  const onSubmit = handleSubmit(async (values) => {
    if (transaction) {
      const input: {
        cost_item_id?: string;
        work_order_id?: string | null;
        payment_method?: TransactionFormValues["payment_method"];
        amount?: string;
        transaction_date?: string;
        reference_number?: string | null;
        remarks?: string | null;
        status?: TransactionStatus;
      } = {};
      if (pendingEditable) {
        const payload = toTransactionPayload(values);
        input.cost_item_id = payload.cost_item_id;
        input.work_order_id = payload.work_order_id;
        input.payment_method = payload.payment_method;
        input.amount = payload.amount;
        input.transaction_date = payload.transaction_date;
        input.reference_number = payload.reference_number;
        input.remarks = payload.remarks;
      }
      if (pendingStatus) input.status = pendingStatus;
      await updateTxn.mutateAsync({ id: transaction.id, input });
    } else {
      await createTxn.mutateAsync(toTransactionPayload(values));
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;
  const allowed = transaction ? ALLOWED_TRANSACTION_TRANSITIONS[transaction.status] : [];
  const terminal = transaction ? allowed.length === 0 && !pendingEditable : false;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Transaction" : "New transaction"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${transaction?.transaction_type ?? ""} · ${transaction?.status ?? ""}`
              : "Vendor Payment or Internal Expense (Phase 7)."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {!isEdit ? (
            <Field label="Type" required error={errors.transaction_type?.message}>
              <Controller
                name="transaction_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === "Internal Expense") setValue("work_order_id", "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE7_CREATE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}

          <Field label="Event" required error={errors.event_id?.message}>
            <Controller
              name="event_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Cost Item" required error={errors.cost_item_id?.message}>
            <Controller
              name="cost_item_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("work_order_id", "");
                  }}
                  disabled={isEdit && !pendingEditable}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost item" />
                  </SelectTrigger>
                  <SelectContent>
                    {costItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {txnType === "Vendor Payment" || transaction?.transaction_type === "Vendor Payment" ? (
            <Field label="Work Order" required error={errors.work_order_id?.message}>
              <Controller
                name="work_order_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={isEdit && !pendingEditable}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select work order" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredWorkOrders.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.work_order_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Amount" required error={errors.amount?.message}>
              <Input {...register("amount")} disabled={isEdit && !pendingEditable} />
            </Field>
            <Field label="Date" required error={errors.transaction_date?.message}>
              <Input
                type="date"
                {...register("transaction_date")}
                disabled={isEdit && !pendingEditable}
              />
            </Field>
          </div>

          <Field label="Payment method" required error={errors.payment_method?.message}>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit && !pendingEditable}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Reference" error={errors.reference_number?.message}>
            <Input {...register("reference_number")} disabled={isEdit && !pendingEditable} />
          </Field>

          <Field label="Remarks" error={errors.remarks?.message}>
            <Textarea {...register("remarks")} disabled={isEdit && !pendingEditable} />
          </Field>

          {isEdit && transaction && allowed.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="txn-status">Change status</Label>
              <Select
                value={pendingStatus || undefined}
                onValueChange={(value) => setPendingStatus(value as TransactionStatus)}
                disabled={submitting}
              >
                <SelectTrigger id="txn-status" aria-label="Change status">
                  <SelectValue placeholder={`Current: ${transaction.status}`} />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {transaction?.status === "Completed" ? (
            <p className="text-sm text-muted">
              Financial fields are locked. Reverse to correct ledger impact.
            </p>
          ) : null}

          {apiError ? (
            <p className="text-sm text-danger" role="alert">
              {apiError}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            {!terminal || pendingStatus ? (
              <Button type="submit" isLoading={submitting}>
                {isEdit ? "Save" : "Create transaction"}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

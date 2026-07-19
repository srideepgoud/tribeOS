"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Checkbox,
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

import { useCostCategories } from "@/features/cost-categories/hooks";
import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostItem, CostItemStatus } from "@/types/cost-item";
import {
  ALLOWED_COST_ITEM_TRANSITIONS,
  EXPENSE_TYPES,
  isBudgetFrozen,
  isCostItemReadOnly,
} from "@/types/cost-item";

import { useCreateCostItem, useCostItemVersions, useUpdateCostItem } from "../hooks";
import {
  costItemFormSchema,
  emptyCostItemForm,
  toCostItemPayload,
  type CostItemFormValues,
} from "../schema";

interface CostItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CostItem | null;
  defaultEventId?: string;
}

export function CostItemFormDialog({
  open,
  onOpenChange,
  item,
  defaultEventId,
}: CostItemFormDialogProps) {
  const isEdit = Boolean(item);
  const readOnly = item ? isCostItemReadOnly(item.status) : false;
  const budgetFrozen = item ? isBudgetFrozen(item.status) : false;
  const createItem = useCreateCostItem();
  const updateItem = useUpdateCostItem();
  const activeMutation = isEdit ? updateItem : createItem;
  const [pendingStatus, setPendingStatus] = useState<CostItemStatus | "">("");

  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const events = eventsQuery.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CostItemFormValues>({
    resolver: zodResolver(costItemFormSchema),
    defaultValues: emptyCostItemForm,
  });

  const selectedEventId = watch("event_id");
  const expenseType = watch("expense_type");

  const categoriesQuery = useCostCategories({
    page: 1,
    page_size: 100,
    event_id: selectedEventId || undefined,
    sort: "display_order",
  });
  const categories = categoriesQuery.data?.data ?? [];

  const versionsQuery = useCostItemVersions(item?.id ?? null);

  useEffect(() => {
    if (!open) return;
    if (item) {
      reset({
        event_id: item.event_id,
        category_id: item.category_id,
        title: item.title,
        description: item.description ?? "",
        expense_type: item.expense_type,
        budget_amount: item.budget_amount,
        negotiated_amount: item.negotiated_amount ?? "",
        vendor_required: item.vendor_required,
        notes: item.notes ?? "",
      });
    } else {
      reset({
        ...emptyCostItemForm,
        event_id: defaultEventId ?? "",
      });
    }
    setPendingStatus("");
    createItem.reset();
    updateItem.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, defaultEventId]);

  useEffect(() => {
    if (expenseType === "Internal") {
      setValue("vendor_required", false);
    }
  }, [expenseType, setValue]);

  const allowedTransitions = useMemo(
    () => (item ? ALLOWED_COST_ITEM_TRANSITIONS[item.status] : []),
    [item],
  );

  const onSubmit = handleSubmit(async (values) => {
    const payload = toCostItemPayload(values);
    if (item) {
      await updateItem.mutateAsync({
        id: item.id,
        input: {
          ...payload,
          ...(pendingStatus ? { status: pendingStatus } : {}),
        },
      });
    } else {
      await createItem.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit cost item" : "New cost item"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? `${item?.status} Cost Items are read-only.`
              : "Budget lines belong to one Event and one Cost Category."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Event" required error={errors.event_id?.message}>
            <Controller
              name="event_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("category_id", "");
                  }}
                  disabled={readOnly || submitting}
                >
                  <SelectTrigger aria-label="Event">
                    <SelectValue placeholder="Select an event" />
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

          <Field label="Cost category" required error={errors.category_id?.message}>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={readOnly || submitting || !selectedEventId}
                >
                  <SelectTrigger aria-label="Cost category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Title" required error={errors.title?.message}>
            <Input {...register("title")} disabled={readOnly} autoFocus />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register("description")} disabled={readOnly} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Expense type" required error={errors.expense_type?.message}>
              <Controller
                name="expense_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={readOnly || submitting}
                  >
                    <SelectTrigger aria-label="Expense type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Budget amount" required error={errors.budget_amount?.message}>
              <Input
                {...register("budget_amount")}
                inputMode="decimal"
                disabled={readOnly || budgetFrozen}
              />
            </Field>
          </div>

          <Field label="Negotiated amount" error={errors.negotiated_amount?.message}>
            <Input
              {...register("negotiated_amount")}
              inputMode="decimal"
              disabled={readOnly || budgetFrozen}
            />
          </Field>

          {item ? (
            <p className="text-sm text-muted">
              Actual amount:{" "}
              <span className="font-medium text-foreground">
                {item.actual_amount ?? "— (system-maintained)"}
              </span>
            </p>
          ) : null}

          <Controller
            name="vendor_required"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={readOnly || expenseType === "Internal" || submitting}
                />
                Vendor required
              </label>
            )}
          />
          {errors.vendor_required ? (
            <p className="text-sm text-danger">{errors.vendor_required.message}</p>
          ) : null}

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} disabled={readOnly} />
          </Field>

          {isEdit && item && !readOnly && allowedTransitions.length > 0 ? (
            <Field label="Change status">
              <Select
                value={pendingStatus || undefined}
                onValueChange={(value) => setPendingStatus(value as CostItemStatus)}
                disabled={submitting}
              >
                <SelectTrigger aria-label="Change status">
                  <SelectValue placeholder={`Current: ${item.status}`} />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          {isEdit && item ? (
            <p className="text-sm text-muted">
              Current status: <span className="font-medium text-foreground">{item.status}</span>
            </p>
          ) : null}

          {versionsQuery.data && versionsQuery.data.length > 0 ? (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Commercial version history</p>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {versionsQuery.data.map((version) => (
                  <li key={version.id}>
                    v{version.version_number}: budget {version.budget_amount}
                    {version.negotiated_amount ? ` · negotiated ${version.negotiated_amount}` : ""}
                  </li>
                ))}
              </ul>
            </div>
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
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly ? (
              <Button type="submit" isLoading={submitting}>
                {isEdit ? "Save changes" : "Create cost item"}
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

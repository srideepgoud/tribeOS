"use client";

import { useEffect } from "react";
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
} from "@tribeos/ui";

import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { useCreateCostCategory, useUpdateCostCategory } from "../hooks";
import {
  costCategoryFormSchema,
  emptyCostCategoryForm,
  toCostCategoryPayload,
  type CostCategoryFormValues,
} from "../schema";

interface CostCategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CostCategory | null;
  defaultEventId?: string;
}

export function CostCategoryFormDialog({
  open,
  onOpenChange,
  category,
  defaultEventId,
}: CostCategoryFormDialogProps) {
  const isEdit = Boolean(category);
  const createCategory = useCreateCostCategory();
  const updateCategory = useUpdateCostCategory();
  const activeMutation = isEdit ? updateCategory : createCategory;

  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const events = eventsQuery.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CostCategoryFormValues>({
    resolver: zodResolver(costCategoryFormSchema),
    defaultValues: emptyCostCategoryForm,
  });

  useEffect(() => {
    if (!open) return;
    if (category) {
      reset({
        event_id: category.event_id,
        name: category.name,
        display_order: category.display_order,
      });
    } else {
      reset({
        ...emptyCostCategoryForm,
        event_id: defaultEventId ?? "",
      });
    }
    createCategory.reset();
    updateCategory.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, defaultEventId]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toCostCategoryPayload(values);
    if (category) {
      await updateCategory.mutateAsync({ id: category.id, input: payload });
    } else {
      await createCategory.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit cost category" : "New cost category"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the category name or display order."
              : "Categories group Cost Items within a single event."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label>
              Event <span className="text-danger">*</span>
            </Label>
            <Controller
              name="event_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={Boolean(errors.event_id)} aria-label="Event">
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
            {errors.event_id ? (
              <p className="text-sm text-danger">{errors.event_id.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Category name <span className="text-danger">*</span>
            </Label>
            <Input
              {...register("name")}
              placeholder="Venue"
              aria-invalid={Boolean(errors.name)}
              autoFocus
            />
            {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Display order</Label>
            <Input
              type="number"
              min={0}
              {...register("display_order")}
              aria-invalid={Boolean(errors.display_order)}
            />
            {errors.display_order ? (
              <p className="text-sm text-danger">{errors.display_order.message}</p>
            ) : null}
          </div>

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
            <Button type="submit" isLoading={submitting}>
              {isEdit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

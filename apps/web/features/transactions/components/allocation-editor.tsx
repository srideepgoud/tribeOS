"use client";

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";

import type { CostItem } from "@/types/cost-item";

import { allocationTotals, type TransactionFormValues } from "../schema";

interface AllocationEditorProps {
  control: Control<TransactionFormValues>;
  register: UseFormRegister<TransactionFormValues>;
  errors: FieldErrors<TransactionFormValues>;
  costItems: CostItem[];
  amount: string;
  allocations: TransactionFormValues["allocations"];
  disabled?: boolean;
}

export function AllocationEditor({
  control,
  register,
  errors,
  costItems,
  amount,
  allocations,
  disabled = false,
}: AllocationEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name: "allocations" });
  const { allocated, remaining } = allocationTotals({ amount, allocations });

  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>Cost Allocations</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => append({ cost_item_id: "", allocated_amount: "" })}
        >
          <Plus className="mr-1 size-4" />
          Add line
        </Button>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <Controller
            control={control}
            name={`allocations.${index}.cost_item_id`}
            render={({ field: selectField }) => (
              <Select
                value={selectField.value || undefined}
                onValueChange={selectField.onChange}
                disabled={disabled}
              >
                <SelectTrigger aria-label={`Allocation Cost Item ${index + 1}`}>
                  <SelectValue placeholder="Cost Item" />
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
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Amount"
            disabled={disabled}
            aria-label={`Allocation amount ${index + 1}`}
            {...register(`allocations.${index}.allocated_amount`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label={`Remove allocation ${index + 1}`}
            onClick={() => remove(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {typeof errors.allocations?.message === "string" ? (
        <p className="text-sm text-destructive">{errors.allocations.message}</p>
      ) : null}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>Allocated: {allocated.toFixed(2)}</span>
        <span>Unattributed: {remaining.toFixed(2)}</span>
        <span>
          State:{" "}
          {allocated <= 0
            ? "Unattributed"
            : remaining <= 0
              ? "Fully Attributed"
              : "Partially Attributed"}
        </span>
      </div>
    </div>
  );
}

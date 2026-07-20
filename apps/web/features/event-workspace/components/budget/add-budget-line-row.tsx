"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Input } from "@tribeos/ui";

import { useCreateCostItem } from "@/features/cost-items/hooks";
import { apiErrorMessage } from "@/services/http";

import { parseBudgetAmount } from "../../lib/budget-utils";

interface AddBudgetLineRowProps {
  eventId: string;
  categoryId: string;
  editable: boolean;
}

export function AddBudgetLineRow({ eventId, categoryId, editable }: AddBudgetLineRowProps) {
  const createItem = useCreateCostItem();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  if (!editable) return null;

  const commit = async () => {
    const trimmedTitle = title.trim();
    const parsedAmount = parseBudgetAmount(amount);
    if (!trimmedTitle && !amount.trim()) return;
    if (!trimmedTitle) {
      setError("Enter a line name.");
      return;
    }
    if (!parsedAmount) {
      setError("Enter a valid planned amount.");
      return;
    }

    setError(null);
    try {
      await createItem.mutateAsync({
        event_id: eventId,
        category_id: categoryId,
        title: trimmedTitle,
        expense_type: "Vendor",
        budget_amount: parsedAmount,
        vendor_required: true,
      });
      setTitle("");
      setAmount("");
      setActive(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create budget line."));
    }
  };

  return (
    <div className="border-b border-border/60 px-4 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-3 pl-6">
        <div className="flex min-w-0 items-center gap-2">
          <Plus className="size-3.5 shrink-0 text-primary" aria-hidden />
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onFocus={() => setActive(true)}
            placeholder="+ Add budget line"
            aria-label="New budget line name"
            className="h-9 border-transparent bg-transparent px-1 shadow-none hover:border-input focus-visible:border-input"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commit();
              }
            }}
          />
        </div>
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onFocus={() => setActive(true)}
          placeholder="Planned ₹"
          inputMode="decimal"
          aria-label="New budget line planned amount"
          className="h-9 border-transparent bg-transparent text-right shadow-none hover:border-input focus-visible:border-input"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
          }}
          onBlur={() => void commit()}
        />
        {active || title.trim() || amount.trim() ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={createItem.isPending}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commit()}
          >
            Add
          </Button>
        ) : (
          <span />
        )}
      </div>
      {error ? (
        <p className="mt-1 pl-6 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

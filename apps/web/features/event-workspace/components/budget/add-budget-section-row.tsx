"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Input } from "@tribeos/ui";

import { useCreateCostCategory } from "@/features/cost-categories/hooks";
import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { nextSectionDisplayOrder } from "../../lib/budget-utils";

interface AddBudgetSectionRowProps {
  eventId: string;
  categories: readonly CostCategory[];
  editable: boolean;
  emphasized?: boolean;
}

export function AddBudgetSectionRow({
  eventId,
  categories,
  editable,
  emphasized = false,
}: AddBudgetSectionRowProps) {
  const createSection = useCreateCostCategory();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  if (!editable) return null;

  const commit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await createSection.mutateAsync({
        event_id: eventId,
        name: trimmed,
        display_order: nextSectionDisplayOrder(categories),
      });
      setName("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create budget section."));
    }
  };

  return (
    <div
      className={
        emphasized
          ? "rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-4"
          : "border-t border-border px-4 py-3"
      }
    >
      <div className="flex max-w-xl items-center gap-2">
        <Plus className="size-4 shrink-0 text-primary" aria-hidden />
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            void commit();
          }}
          placeholder="+ Add budget section"
          aria-label="New budget section name"
          className="border-transparent bg-transparent px-1 font-medium shadow-none hover:border-input focus-visible:border-input"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void commit();
            }
          }}
        />
        {focused || name.trim() ? (
          <Button
            type="button"
            size="sm"
            disabled={!name.trim() || createSection.isPending}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => void commit()}
          >
            Add
          </Button>
        ) : null}
      </div>
      {emphasized ? (
        <p className="mt-2 text-xs text-muted">
          Type a section name (e.g. Production, F&amp;B) and press Enter — no dialogs.
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

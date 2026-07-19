"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";
import type { CostCategory } from "@/types/cost-category";

import { useDeleteCostCategory } from "../hooks";

interface ArchiveCostCategoryDialogProps {
  category: CostCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveCostCategoryDialog({
  category,
  open,
  onOpenChange,
}: ArchiveCostCategoryDialogProps) {
  const deleteCategory = useDeleteCostCategory();

  if (!category) return null;

  const apiError = deleteCategory.error ? apiErrorMessage(deleteCategory.error) : null;

  const onConfirm = async () => {
    await deleteCategory.mutateAsync(category.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!deleteCategory.isPending ? onOpenChange(next) : undefined)}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive cost category</DialogTitle>
          <DialogDescription>
            {category.name} will be archived. Categories are never permanently deleted.
          </DialogDescription>
        </DialogHeader>

        {apiError ? (
          <p className="text-sm text-danger" role="alert">
            {apiError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={deleteCategory.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" isLoading={deleteCategory.isPending} onClick={onConfirm}>
            Archive category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

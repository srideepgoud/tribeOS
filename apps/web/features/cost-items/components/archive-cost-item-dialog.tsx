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
import type { CostItem } from "@/types/cost-item";

import { useDeleteCostItem } from "../hooks";

export function ArchiveCostItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: CostItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteItem = useDeleteCostItem();
  if (!item) return null;

  const apiError = deleteItem.error ? apiErrorMessage(deleteItem.error) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!deleteItem.isPending ? onOpenChange(next) : undefined)}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive cost item</DialogTitle>
          <DialogDescription>
            {item.title} will be archived. Cost Items are never permanently deleted.
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
            disabled={deleteItem.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            isLoading={deleteItem.isPending}
            onClick={async () => {
              await deleteItem.mutateAsync(item.id);
              onOpenChange(false);
            }}
          >
            Archive cost item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

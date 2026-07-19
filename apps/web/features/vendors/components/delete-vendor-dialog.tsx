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
import type { Vendor } from "@/types/vendor";

import { useDeleteVendor } from "../hooks";

interface DeleteVendorDialogProps {
  vendor: Vendor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteVendorDialog({ vendor, open, onOpenChange }: DeleteVendorDialogProps) {
  const deleteVendor = useDeleteVendor();

  if (!vendor) return null;

  const apiError = deleteVendor.error ? apiErrorMessage(deleteVendor.error) : null;

  const onConfirm = async () => {
    await deleteVendor.mutateAsync(vendor.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!deleteVendor.isPending ? onOpenChange(next) : undefined)}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive vendor</DialogTitle>
          <DialogDescription>
            {vendor.company_name} will be archived. Vendors are never permanently deleted and can
            be restored later.
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
            disabled={deleteVendor.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" isLoading={deleteVendor.isPending} onClick={onConfirm}>
            Archive vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

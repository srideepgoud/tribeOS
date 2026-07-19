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
import type { Client } from "@/types/client";

import { useDeleteClient } from "../hooks";

interface DeleteClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteClientDialog({ client, open, onOpenChange }: DeleteClientDialogProps) {
  const deleteClient = useDeleteClient();

  if (!client) return null;

  const apiError = deleteClient.error ? apiErrorMessage(deleteClient.error) : null;

  const onConfirm = async () => {
    await deleteClient.mutateAsync(client.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!deleteClient.isPending ? onOpenChange(next) : undefined)}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive client</DialogTitle>
          <DialogDescription>
            {client.company_name} will be archived. Clients are never permanently deleted and can
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
            disabled={deleteClient.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" isLoading={deleteClient.isPending} onClick={onConfirm}>
            Archive client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

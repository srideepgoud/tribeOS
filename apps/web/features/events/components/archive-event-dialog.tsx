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
import type { Event } from "@/types/event";

import { useDeleteEvent } from "../hooks";

interface ArchiveEventDialogProps {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveEventDialog({ event, open, onOpenChange }: ArchiveEventDialogProps) {
  const deleteEvent = useDeleteEvent();

  if (!event) return null;

  const apiError = deleteEvent.error ? apiErrorMessage(deleteEvent.error) : null;

  const onConfirm = async () => {
    await deleteEvent.mutateAsync(event.id);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!deleteEvent.isPending ? onOpenChange(next) : undefined)}
    >
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Archive event</DialogTitle>
          <DialogDescription>
            {event.name} will be archived. Only Draft events may be archived; history is preserved.
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
            disabled={deleteEvent.isPending}
          >
            Cancel
          </Button>
          <Button variant="danger" isLoading={deleteEvent.isPending} onClick={onConfirm}>
            Archive event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

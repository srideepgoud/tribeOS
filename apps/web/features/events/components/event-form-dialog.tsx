"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
  Textarea,
} from "@tribeos/ui";

import { useClients } from "@/features/clients/hooks";
import { apiErrorMessage } from "@/services/http";
import type { Event, EventStatus } from "@/types/event";
import { isEventReadOnly } from "@/types/event";

import { useCreateEvent, useUpdateEvent } from "../hooks";
import {
  emptyEventForm,
  eventToFormValues,
  toEventPayload,
  eventFormSchema,
  type EventFormValues,
} from "../schema";
import { StatusTransitionControl } from "./status-transition-control";

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
}

export function EventFormDialog({ open, onOpenChange, event }: EventFormDialogProps) {
  const isEdit = Boolean(event);
  const readOnly = event ? isEventReadOnly(event.status) : false;
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const activeMutation = isEdit ? updateEvent : createEvent;
  const [pendingStatus, setPendingStatus] = useState<EventStatus | "">("");

  const clientsQuery = useClients({ page: 1, page_size: 100, sort: "company_name" });
  const clients = clientsQuery.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: emptyEventForm,
  });

  useEffect(() => {
    if (!open) return;
    reset(event ? eventToFormValues(event) : emptyEventForm);
    setPendingStatus("");
    createEvent.reset();
    updateEvent.reset();
    // Reset form + mutation state only when the dialog (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toEventPayload(values);
    if (event) {
      const input = {
        ...payload,
        ...(pendingStatus ? { status: pendingStatus } : {}),
      };
      await updateEvent.mutateAsync({ id: event.id, input });
    } else {
      await createEvent.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? `${event?.status} events are read-only.`
              : isEdit
                ? "Update event details or advance the lifecycle status."
                : "Create an event and associate it with a client."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Client" required error={errors.client_id?.message}>
            <Controller
              name="client_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={field.onChange}
                  disabled={readOnly || submitting}
                >
                  <SelectTrigger aria-invalid={Boolean(errors.client_id)} aria-label="Client">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Event name" required error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="Acme Annual Gala"
              aria-invalid={Boolean(errors.name)}
              disabled={readOnly}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Venue" error={errors.venue?.message}>
              <Input {...register("venue")} placeholder="Grand Hyatt" disabled={readOnly} />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <Input {...register("city")} placeholder="Hyderabad" disabled={readOnly} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start" error={errors.start_datetime?.message}>
              <Input
                type="datetime-local"
                {...register("start_datetime")}
                disabled={readOnly}
              />
            </Field>
            <Field label="End" error={errors.end_datetime?.message}>
              <Input type="datetime-local" {...register("end_datetime")} disabled={readOnly} />
            </Field>
          </div>

          <Field label="Expected revenue" error={errors.expected_revenue?.message}>
            <Input
              {...register("expected_revenue")}
              placeholder="25000.00"
              inputMode="decimal"
              disabled={readOnly}
            />
          </Field>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} placeholder="Planning notes" disabled={readOnly} />
          </Field>

          {isEdit && event && !readOnly ? (
            <StatusTransitionControl
              current={event.status}
              value={pendingStatus}
              onChange={setPendingStatus}
              disabled={submitting}
            />
          ) : null}

          {isEdit && event ? (
            <p className="text-sm text-muted">
              Current status: <span className="font-medium text-foreground">{event.status}</span>
            </p>
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
                {isEdit ? "Save changes" : "Create event"}
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

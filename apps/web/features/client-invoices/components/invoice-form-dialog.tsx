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
  Textarea,
} from "@tribeos/ui";

import { useEvents } from "@/features/events/hooks";
import { apiErrorMessage } from "@/services/http";
import type { ClientInvoice } from "@/types/client-invoice";

import { useCreateClientInvoice, useUpdateClientInvoice } from "../hooks";
import {
  clientInvoiceFormSchema,
  emptyClientInvoiceForm,
  toClientInvoicePayload,
  type ClientInvoiceFormValues,
} from "../schema";

interface ClientInvoiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: ClientInvoice | null;
  defaultEventId?: string;
}

function toFormValues(invoice: ClientInvoice): ClientInvoiceFormValues {
  return {
    event_id: invoice.event_id,
    client_id: invoice.client_id,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date ?? "",
    amount: invoice.amount,
    gst_amount: invoice.gst_amount,
    total_amount: invoice.total_amount,
    notes: invoice.notes ?? "",
  };
}

export function ClientInvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  defaultEventId,
}: ClientInvoiceFormDialogProps) {
  const isEdit = Boolean(invoice);
  const createMutation = useCreateClientInvoice();
  const updateMutation = useUpdateClientInvoice();
  const active = isEdit ? updateMutation : createMutation;

  const eventsQuery = useEvents({ page: 1, page_size: 100, sort: "name" });
  const events = eventsQuery.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClientInvoiceFormValues>({
    resolver: zodResolver(clientInvoiceFormSchema),
    defaultValues: emptyClientInvoiceForm,
  });

  const eventId = watch("event_id");
  const draftOnly = !invoice || invoice.status === "Draft";

  useEffect(() => {
    if (!open) return;
    reset(
      invoice
        ? toFormValues(invoice)
        : {
            ...emptyClientInvoiceForm,
            event_id: defaultEventId ?? "",
          },
    );
    createMutation.reset();
    updateMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice, defaultEventId]);

  useEffect(() => {
    if (!eventId || isEdit) return;
    const event = events.find((row) => row.id === eventId);
    if (event) setValue("client_id", event.client_id);
  }, [eventId, events, isEdit, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && invoice) {
        await updateMutation.mutateAsync({
          id: invoice.id,
          input: draftOnly
            ? toClientInvoicePayload(values)
            : { notes: values.notes?.trim() || null },
        });
      } else {
        await createMutation.mutateAsync(toClientInvoicePayload(values));
      }
      onOpenChange(false);
    } catch {
      /* surfaced via active.error */
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit invoice" : "New client invoice"}</DialogTitle>
          <DialogDescription>
            Commercial claim against the client. Cash is recorded separately as Client Receipts.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="event_id">Event</Label>
            {defaultEventId && !isEdit ? (
              <p className="text-sm text-foreground">
                {events.find((row) => row.id === defaultEventId)?.name ?? "Selected event"}
              </p>
            ) : (
              <Controller
                control={control}
                name="event_id"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isEdit && !draftOnly}
                  >
                    <SelectTrigger id="event_id">
                      <SelectValue placeholder="Select event" />
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
            )}
            {errors.event_id ? (
              <p className="text-sm text-danger">{errors.event_id.message}</p>
            ) : null}
          </div>

          <input type="hidden" {...register("client_id")} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice_date">Invoice date</Label>
              <Input
                id="invoice_date"
                type="date"
                disabled={isEdit && !draftOnly}
                {...register("invoice_date")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input
                id="due_date"
                type="date"
                disabled={isEdit && !draftOnly}
                {...register("due_date")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" disabled={isEdit && !draftOnly} {...register("amount")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gst_amount">GST</Label>
              <Input id="gst_amount" disabled={isEdit && !draftOnly} {...register("gst_amount")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="total_amount">Total</Label>
              <Input
                id="total_amount"
                disabled={isEdit && !draftOnly}
                {...register("total_amount")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} {...register("notes")} />
          </div>

          {active.error ? (
            <p className="text-sm text-danger">{apiErrorMessage(active.error)}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || active.isPending}>
              {isEdit ? "Save" : "Create invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

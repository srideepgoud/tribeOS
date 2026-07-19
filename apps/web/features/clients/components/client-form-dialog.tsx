"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
  Textarea,
} from "@tribeos/ui";

import { apiErrorMessage } from "@/services/http";
import type { Client } from "@/types/client";

import { useCreateClient, useUpdateClient } from "../hooks";
import {
  clientFormSchema,
  emptyClientForm,
  toClientPayload,
  type ClientFormValues,
} from "../schema";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

function toFormValues(client: Client): ClientFormValues {
  return {
    company_name: client.company_name,
    gst_number: client.gst_number ?? "",
    phone: client.phone ?? "",
    email: client.email ?? "",
    billing_address: client.billing_address ?? "",
    notes: client.notes ?? "",
  };
}

export function ClientFormDialog({ open, onOpenChange, client }: ClientFormDialogProps) {
  const isEdit = Boolean(client);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const activeMutation = isEdit ? updateClient : createClient;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: emptyClientForm,
  });

  useEffect(() => {
    if (!open) return;
    reset(client ? toFormValues(client) : emptyClientForm);
    createClient.reset();
    updateClient.reset();
    // Reset form + mutation state only when the dialog (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toClientPayload(values);
    if (client) {
      await updateClient.mutateAsync({ id: client.id, input: payload });
    } else {
      await createClient.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the client details below." : "Add a new client to TribeOS."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Company name" required error={errors.company_name?.message}>
            <Input
              {...register("company_name")}
              placeholder="Acme Events Pvt Ltd"
              aria-invalid={Boolean(errors.company_name)}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...register("email")}
                placeholder="contact@acme.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input {...register("phone")} placeholder="+91 98765 43210" />
            </Field>
          </div>

          <Field label="GST number" error={errors.gst_number?.message}>
            <Input {...register("gst_number")} placeholder="22AAAAA0000A1Z5" />
          </Field>

          <Field label="Billing address" error={errors.billing_address?.message}>
            <Textarea {...register("billing_address")} placeholder="Street, city, state, PIN" />
          </Field>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register("notes")} placeholder="Anything worth remembering" />
          </Field>

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
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {isEdit ? "Save changes" : "Create client"}
            </Button>
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

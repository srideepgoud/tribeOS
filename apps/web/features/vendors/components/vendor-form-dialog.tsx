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
import type { Vendor } from "@/types/vendor";

import { useCreateVendor, useUpdateVendor } from "../hooks";
import {
  emptyVendorForm,
  toVendorPayload,
  vendorFormSchema,
  type VendorFormValues,
} from "../schema";

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
}

function toFormValues(vendor: Vendor): VendorFormValues {
  return {
    company_name: vendor.company_name,
    contact_name: vendor.contact_name ?? "",
    phone: vendor.phone ?? "",
    email: vendor.email ?? "",
    gst_number: vendor.gst_number ?? "",
    pan_number: vendor.pan_number ?? "",
    bank_name: vendor.bank_name ?? "",
    account_number: vendor.account_number ?? "",
    ifsc: vendor.ifsc ?? "",
    notes: vendor.notes ?? "",
  };
}

export function VendorFormDialog({ open, onOpenChange, vendor }: VendorFormDialogProps) {
  const isEdit = Boolean(vendor);
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const activeMutation = isEdit ? updateVendor : createVendor;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: emptyVendorForm,
  });

  useEffect(() => {
    if (!open) return;
    reset(vendor ? toFormValues(vendor) : emptyVendorForm);
    createVendor.reset();
    updateVendor.reset();
    // Reset form + mutation state only when the dialog (re)opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vendor]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = toVendorPayload(values);
    if (vendor) {
      await updateVendor.mutateAsync({ id: vendor.id, input: payload });
    } else {
      await createVendor.mutateAsync(payload);
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the vendor details below." : "Add a new vendor to TribeOS."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Company name" required error={errors.company_name?.message}>
            <Input
              {...register("company_name")}
              placeholder="Audio Pro Pvt Ltd"
              aria-invalid={Boolean(errors.company_name)}
              autoFocus
            />
          </Field>

          <Field label="Contact name" error={errors.contact_name?.message}>
            <Input {...register("contact_name")} placeholder="Ravi Kumar" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...register("email")}
                placeholder="contact@audiopro.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field label="Phone" error={errors.phone?.message}>
              <Input {...register("phone")} placeholder="+91 98765 43210" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="GST number" error={errors.gst_number?.message}>
              <Input {...register("gst_number")} placeholder="22AAAAA0000A1Z5" />
            </Field>
            <Field label="PAN number" error={errors.pan_number?.message}>
              <Input {...register("pan_number")} placeholder="ABCDE1234F" />
            </Field>
          </div>

          <Field label="Bank name" error={errors.bank_name?.message}>
            <Input {...register("bank_name")} placeholder="HDFC Bank" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Account number" error={errors.account_number?.message}>
              <Input {...register("account_number")} placeholder="1234567890" />
            </Field>
            <Field label="IFSC" error={errors.ifsc?.message}>
              <Input {...register("ifsc")} placeholder="HDFC0001234" />
            </Field>
          </div>

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
              {isEdit ? "Save changes" : "Create vendor"}
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

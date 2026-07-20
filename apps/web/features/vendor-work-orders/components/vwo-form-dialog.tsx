"use client";

import { useEffect, useMemo, useState } from "react";
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

import { useCostItems } from "@/features/cost-items/hooks";
import { useVendors } from "@/features/vendors/hooks";
import { apiErrorMessage } from "@/services/http";
import type { VendorWorkOrder, VendorWorkOrderStatus } from "@/types/vendor-work-order";
import { isCommercialLocked, isTerminalVwoStatus } from "@/types/vendor-work-order";

import { useCreateVendorWorkOrder, useUpdateVendorWorkOrder } from "../hooks";
import {
  emptyVendorWorkOrderForm,
  toVendorWorkOrderPayload,
  vendorWorkOrderFormSchema,
  type VendorWorkOrderFormValues,
} from "../schema";
import { StatusTransitionControl } from "./status-transition-control";

interface VendorWorkOrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrder?: VendorWorkOrder | null;
  defaultCostItemId?: string;
}

function toFormValues(workOrder: VendorWorkOrder): VendorWorkOrderFormValues {
  return {
    cost_item_id: workOrder.cost_item_id,
    vendor_id: workOrder.vendor_id,
    scope: workOrder.scope ?? "",
    agreed_amount: workOrder.agreed_amount ?? "",
    issue_date: workOrder.issue_date ?? "",
    expected_completion: workOrder.expected_completion ?? "",
  };
}

export function VendorWorkOrderFormDialog({
  open,
  onOpenChange,
  workOrder,
  defaultCostItemId,
}: VendorWorkOrderFormDialogProps) {
  const isEdit = Boolean(workOrder);
  const commercialLocked = workOrder ? isCommercialLocked(workOrder.status) : false;
  const terminal = workOrder ? isTerminalVwoStatus(workOrder.status) : false;
  const createWo = useCreateVendorWorkOrder();
  const updateWo = useUpdateVendorWorkOrder();
  const activeMutation = isEdit ? updateWo : createWo;
  const [pendingStatus, setPendingStatus] = useState<VendorWorkOrderStatus | "">("");

  const vendorsQuery = useVendors({ page: 1, page_size: 100, sort: "company_name" });
  const costItemsQuery = useCostItems({ page: 1, page_size: 100, sort: "title" });
  const vendors = vendorsQuery.data?.data ?? [];
  const vendorCostItems = useMemo(
    () => (costItemsQuery.data?.data ?? []).filter((item) => item.expense_type === "Vendor"),
    [costItemsQuery.data?.data],
  );

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VendorWorkOrderFormValues>({
    resolver: zodResolver(vendorWorkOrderFormSchema),
    defaultValues: emptyVendorWorkOrderForm,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      workOrder
        ? toFormValues(workOrder)
        : {
            ...emptyVendorWorkOrderForm,
            cost_item_id: defaultCostItemId ?? "",
          },
    );
    setPendingStatus("");
    createWo.reset();
    updateWo.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workOrder, defaultCostItemId]);

  const onSubmit = handleSubmit(async (values) => {
    if (workOrder) {
      const payload = toVendorWorkOrderPayload(values);
      const input: {
        vendor_id?: string;
        scope?: string | null;
        agreed_amount?: string | null;
        issue_date?: string | null;
        expected_completion?: string | null;
        status?: VendorWorkOrderStatus;
      } = commercialLocked
        ? {}
        : {
            vendor_id: payload.vendor_id,
            scope: payload.scope,
            agreed_amount: payload.agreed_amount,
            issue_date: payload.issue_date,
            expected_completion: payload.expected_completion,
          };
      if (pendingStatus) input.status = pendingStatus;
      await updateWo.mutateAsync({ id: workOrder.id, input });
    } else {
      await createWo.mutateAsync(toVendorWorkOrderPayload(values));
    }
    onOpenChange(false);
  });

  const submitting = isSubmitting || activeMutation.isPending;
  const apiError = activeMutation.error ? apiErrorMessage(activeMutation.error) : null;
  const fieldsDisabled = commercialLocked || terminal;

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-[560px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit work order" : "New work order"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? workOrder
                ? `${workOrder.work_order_number} · version ${workOrder.version}`
                : "Update the work order."
              : "Assign a Vendor-type Cost Item to a supplier."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {!isEdit ? (
            defaultCostItemId ? (
              <Field label="Budget line">
                <p className="text-sm text-foreground">
                  {vendorCostItems.find((item) => item.id === defaultCostItemId)?.title ??
                    "Selected budget line"}
                </p>
              </Field>
            ) : (
              <Field label="Cost Item" required error={errors.cost_item_id?.message}>
                <Controller
                  name="cost_item_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={Boolean(errors.cost_item_id)}>
                        <SelectValue placeholder="Select cost item" />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorCostItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )
          ) : null}

          {!isEdit ? (
            <Field label="Vendor" required error={errors.vendor_id?.message}>
              <Controller
                name="vendor_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.vendor_id)}>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : (
            <Field label="Vendor" error={errors.vendor_id?.message}>
              <Controller
                name="vendor_id"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={field.onChange}
                    disabled={fieldsDisabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}

          <Field label="Agreed amount" error={errors.agreed_amount?.message}>
            <Input
              {...register("agreed_amount")}
              placeholder="Defaults to Negotiated Cost"
              disabled={fieldsDisabled}
            />
          </Field>

          <Field label="Scope" error={errors.scope?.message}>
            <Textarea
              {...register("scope")}
              placeholder="Describe the commercial scope"
              disabled={fieldsDisabled}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Issue date" error={errors.issue_date?.message}>
              <Input type="date" {...register("issue_date")} disabled={fieldsDisabled} />
            </Field>
            <Field label="Expected completion" error={errors.expected_completion?.message}>
              <Input type="date" {...register("expected_completion")} disabled={fieldsDisabled} />
            </Field>
          </div>

          {isEdit && workOrder && !terminal ? (
            <StatusTransitionControl
              current={workOrder.status}
              value={pendingStatus}
              onChange={setPendingStatus}
              disabled={submitting}
            />
          ) : null}

          {commercialLocked && !terminal ? (
            <p className="text-sm text-muted">
              Commercial fields are locked after Issued. Only status can change.
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
              Cancel
            </Button>
            {!terminal ? (
              <Button type="submit" isLoading={submitting}>
                {isEdit ? "Save changes" : "Create work order"}
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

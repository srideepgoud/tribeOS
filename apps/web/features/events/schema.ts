import { z } from "zod";

import { emptyToNull } from "@/lib/forms";
import type { EventCreateInput } from "@/types/event";

export const eventFormSchema = z
  .object({
    client_id: z.string().uuid("Select a client"),
    name: z.string().trim().min(1, "Event name is required").max(255),
    venue: z.string().trim().max(255).optional().or(z.literal("")),
    city: z.string().trim().max(255).optional().or(z.literal("")),
    start_datetime: z.string().optional().or(z.literal("")),
    end_datetime: z.string().optional().or(z.literal("")),
    expected_revenue: z.string().trim().optional().or(z.literal("")),
    notes: z.string().trim().optional().or(z.literal("")),
  })
  .superRefine((values, ctx) => {
    if (values.expected_revenue && values.expected_revenue.trim() !== "") {
      const parsed = Number(values.expected_revenue);
      if (Number.isNaN(parsed) || parsed < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid non-negative amount",
          path: ["expected_revenue"],
        });
      }
    }
    if (values.start_datetime && values.end_datetime) {
      if (new Date(values.end_datetime) < new Date(values.start_datetime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "End must be on or after start",
          path: ["end_datetime"],
        });
      }
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const emptyEventForm: EventFormValues = {
  client_id: "",
  name: "",
  venue: "",
  city: "",
  start_datetime: "",
  end_datetime: "",
  expected_revenue: "",
  notes: "",
};

function toIsoOrNull(localValue: string | undefined): string | null {
  const trimmed = emptyToNull(localValue);
  if (!trimmed) return null;
  // datetime-local values lack timezone; treat as local and send ISO UTC.
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function fromIsoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function eventToFormValues(event: {
  client_id: string;
  name: string;
  venue: string | null;
  city: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  expected_revenue: string | null;
  notes: string | null;
}): EventFormValues {
  return {
    client_id: event.client_id,
    name: event.name,
    venue: event.venue ?? "",
    city: event.city ?? "",
    start_datetime: fromIsoToLocalInput(event.start_datetime),
    end_datetime: fromIsoToLocalInput(event.end_datetime),
    expected_revenue: event.expected_revenue ?? "",
    notes: event.notes ?? "",
  };
}

/** Convert form values to an API payload: blank optionals become null. */
export function toEventPayload(values: EventFormValues): EventCreateInput {
  const revenue = emptyToNull(values.expected_revenue);
  return {
    client_id: values.client_id,
    name: values.name.trim(),
    venue: emptyToNull(values.venue),
    city: emptyToNull(values.city),
    start_datetime: toIsoOrNull(values.start_datetime),
    end_datetime: toIsoOrNull(values.end_datetime),
    expected_revenue: revenue,
    notes: emptyToNull(values.notes),
  };
}

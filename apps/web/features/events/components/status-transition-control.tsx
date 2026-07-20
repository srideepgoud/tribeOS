"use client";

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import type { EventStatus } from "@/types/event";
import { ALLOWED_TRANSITIONS } from "@/types/event";

interface StatusTransitionControlProps {
  current: EventStatus;
  value: EventStatus | "";
  onChange: (next: EventStatus | "") => void;
  disabled?: boolean;
  /** When false, Settlement → Closed is not selectable (backend readiness). */
  allowClose?: boolean;
}

export function StatusTransitionControl({
  current,
  value,
  onChange,
  disabled,
  allowClose = true,
}: StatusTransitionControlProps) {
  const allowed = ALLOWED_TRANSITIONS[current].filter(
    (status) => status !== "Closed" || allowClose,
  );

  if (ALLOWED_TRANSITIONS[current].length === 0) {
    return (
      <p className="text-sm text-muted">
        Status <span className="font-medium text-foreground">{current}</span> is terminal — no further
        transitions.
      </p>
    );
  }

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-muted">
        Close Event is unavailable until financial readiness checks pass.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="event-status-transition">Change status</Label>
      <Select
        value={value || undefined}
        onValueChange={(next) => onChange(next as EventStatus)}
        disabled={disabled}
      >
        <SelectTrigger id="event-status-transition" aria-label="Change status">
          <SelectValue placeholder={`Current: ${current}`} />
        </SelectTrigger>
        <SelectContent>
          {allowed.map((status) => (
            <SelectItem key={status} value={status}>
              {status === "Closed" ? "Close Event" : status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted">
        Status changes follow the Event lifecycle and cannot be skipped.
      </p>
    </div>
  );
}

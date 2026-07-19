"use client";

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tribeos/ui";

import type { EventStatus } from "@/types/event";
import { ALLOWED_TRANSITIONS } from "@/types/event";

interface StatusTransitionControlProps {
  current: EventStatus;
  value: EventStatus | "";
  onChange: (next: EventStatus | "") => void;
  disabled?: boolean;
}

export function StatusTransitionControl({
  current,
  value,
  onChange,
  disabled,
}: StatusTransitionControlProps) {
  const allowed = ALLOWED_TRANSITIONS[current];

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-muted">
        Status <span className="font-medium text-foreground">{current}</span> is terminal — no further
        transitions.
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
              {status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted">Status changes follow the Event lifecycle and cannot be skipped.</p>
    </div>
  );
}

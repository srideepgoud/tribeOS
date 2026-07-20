"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@tribeos/ui";

interface InlineBudgetInputProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputMode?: "text" | "decimal";
  ariaLabel: string;
}

export function InlineBudgetInput({
  value,
  onSave,
  disabled = false,
  placeholder,
  className,
  inputMode = "text",
  ariaLabel,
}: InlineBudgetInputProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const skipBlurSave = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    if (disabled || saving || draft === value) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (skipBlurSave.current) {
          skipBlurSave.current = false;
          return;
        }
        void commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          skipBlurSave.current = true;
          void commit();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          skipBlurSave.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      disabled={disabled || saving}
      placeholder={placeholder}
      className={className}
      inputMode={inputMode}
      aria-label={ariaLabel}
    />
  );
}

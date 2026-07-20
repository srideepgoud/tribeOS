"use client";

interface OverviewCardProps {
  label: string;
  value: number;
}

export function OverviewCard({ label, value }: OverviewCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

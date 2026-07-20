"use client";

interface FinanceCardProps {
  label: string;
  value: string;
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function FinanceCard({ label, value }: FinanceCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{formatMoney(value)}</p>
    </div>
  );
}

export { formatMoney };

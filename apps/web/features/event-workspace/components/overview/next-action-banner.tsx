"use client";

import Link from "next/link";
import { buttonVariants, cn } from "@tribeos/ui";

import type { NextAction } from "../../hooks";

interface NextActionBannerProps {
  action: NextAction;
}

export function NextActionBanner({ action }: NextActionBannerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">Next action</p>
        <p className="text-base font-semibold text-foreground">{action.label}</p>
        <p className="text-sm text-muted">{action.description}</p>
      </div>
      <Link
        href={action.href}
        className={cn(buttonVariants({ variant: "primary" }))}
      >
        Go
      </Link>
    </div>
  );
}

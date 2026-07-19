import { cn } from "@tribeos/ui";

/** The TR!BE wordmark. The exclamation mark is part of the brand identity. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-xl font-bold tracking-tight text-foreground", className)}>
      TR<span className="text-primary">!</span>BE
    </span>
  );
}

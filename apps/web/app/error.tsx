"use client";

import { Button } from "@tribeos/ui";

/**
 * Route error boundary. Shows friendly copy and a recovery action.
 * Never exposes stack traces to the user.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted">
        An unexpected error occurred. You can try again.
      </p>
      <Button variant="secondary" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

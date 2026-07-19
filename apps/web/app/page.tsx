import { Wordmark } from "@/components/layout/wordmark";

/**
 * Root route. Intentionally minimal — no business content, dashboards, or data.
 * Business modules render their own routes from later milestones onward.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Wordmark className="text-3xl" />
      <p className="max-w-md text-sm text-muted">
        Foundation ready. Application modules will appear here in upcoming milestones.
      </p>
    </div>
  );
}

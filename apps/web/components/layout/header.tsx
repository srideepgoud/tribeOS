import { Wordmark } from "./wordmark";

/**
 * Top navigation/header (structural only). 72px tall, sticky. Global actions
 * (search, notifications, account menu) are added in later milestones.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <span className="lg:hidden">
          <Wordmark />
        </span>
      </div>

      <div className="flex items-center gap-3" data-region="header-actions">
        {/* Reserved for global actions (added in later phases). */}
      </div>
    </header>
  );
}

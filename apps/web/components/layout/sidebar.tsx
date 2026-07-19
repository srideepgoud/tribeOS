import { Wordmark } from "./wordmark";

/**
 * Application sidebar (structural only). Fixed 280px on large screens, hidden
 * below the `lg` breakpoint. Business navigation items are intentionally NOT
 * included in this phase — the nav region is an empty structural placeholder.
 */
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-border bg-surface lg:flex">
      <div className="flex h-[72px] shrink-0 items-center border-b border-border px-6">
        <Wordmark />
      </div>

      <nav
        aria-label="Primary"
        className="flex-1 overflow-y-auto p-4"
        data-region="primary-navigation"
      >
        {/* Navigation items are added by business modules in later milestones. */}
      </nav>

      <div className="shrink-0 border-t border-border p-4" data-region="sidebar-footer">
        {/* Reserved for account / user controls (added with authentication). */}
      </div>
    </aside>
  );
}

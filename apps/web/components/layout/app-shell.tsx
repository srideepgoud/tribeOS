import type { ReactNode } from "react";

import { Header } from "./header";
import { Sidebar } from "./sidebar";

/**
 * Application shell: sidebar + header + responsive content container.
 * Wraps every route via the root layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col lg:pl-[280px]">
        <Header />
        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-[1536px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

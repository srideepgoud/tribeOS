"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListTree,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@tribeos/ui";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Operations", icon: LayoutDashboard }],
  },
  {
    label: "Work",
    defaultOpen: true,
    items: [
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/clients", label: "Clients", icon: Users },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/client-invoices", label: "Client Invoices", icon: FileText },
      { href: "/transactions", label: "Transactions", icon: Banknote },
    ],
  },
  {
    label: "Procurement",
    items: [
      { href: "/vendors", label: "Vendors", icon: Store },
      { href: "/vendor-work-orders", label: "Work Orders", icon: ClipboardList },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/cost-categories", label: "Cost Categories", icon: FolderTree },
      { href: "/cost-items", label: "Cost Items", icon: ListTree },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/events") {
    return pathname === "/events" || pathname.startsWith("/events/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-hover text-foreground"
            : "text-foreground-secondary hover:bg-hover hover:text-foreground",
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="size-5" />
        {item.label}
      </Link>
    </li>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-4">
      {NAV_GROUPS.map((group) => (
        <details key={group.label} className="group" open={group.defaultOpen ?? false}>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
            {group.label}
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

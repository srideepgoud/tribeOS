"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListTree,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@tribeos/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Operations", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/cost-categories", label: "Cost Categories", icon: FolderTree },
  { href: "/cost-items", label: "Cost Items", icon: ListTree },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/vendor-work-orders", label: "Work Orders", icon: ClipboardList },
  { href: "/client-invoices", label: "Client Invoices", icon: FileText },
  { href: "/transactions", label: "Transactions", icon: Banknote },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-hover text-foreground"
                  : "text-foreground-secondary hover:bg-hover hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

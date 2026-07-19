"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users } from "lucide-react";
import { cn } from "@tribeos/ui";

// Structural navigation. Only the Clients entry exists in this milestone;
// further entries are added as their business modules are built.
const NAV_ITEMS = [{ href: "/clients", label: "Clients", icon: Users }] as const;

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

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_ITEMS } from "@/components/app-shell/nav-config";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-0")}>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">Command Center</span>}
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto py-2">
        <ul className="flex flex-col gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const link = (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            return (
              <li key={item.href}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger render={link} />
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-2">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 outline-none",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

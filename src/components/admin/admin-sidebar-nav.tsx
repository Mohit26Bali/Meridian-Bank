"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileCheck2, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, roles: null },
  { label: "Users", href: "/admin/users", icon: Users, roles: null },
  { label: "KYC Review", href: "/admin/kyc", icon: FileCheck2, roles: null },
  {
    label: "Audit Logs",
    href: "/admin/audit-logs",
    icon: ScrollText,
    roles: ["AUDITOR", "ADMIN", "SUPER_ADMIN"],
  },
];

export function AdminSidebarNav({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: string;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const isActive =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary-hover"
                : "text-foreground-secondary hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Send,
  CreditCard,
  Landmark,
  Users,
  LineChart,
  UserCircle,
  Settings,
  Bell,
  LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Banking",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Accounts", href: "/dashboard/accounts", icon: Wallet },
      { label: "Transactions", href: "/dashboard/transactions", icon: ArrowLeftRight },
      { label: "Transfer Money", href: "/dashboard/transfer", icon: Send },
    ],
  },
  {
    label: "Products",
    items: [
      { label: "Cards", href: "/dashboard/cards", icon: CreditCard },
      { label: "Loans", href: "/dashboard/loans", icon: Landmark },
      { label: "Beneficiaries", href: "/dashboard/beneficiaries", icon: Users },
      { label: "Investments", href: "/dashboard/investments", icon: LineChart },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", href: "/dashboard/profile", icon: UserCircle },
      { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
];

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-foreground-muted px-3 text-xs font-semibold tracking-wide uppercase">
            {group.label}
          </p>
          <div className="mt-2 flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
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
          </div>
        </div>
      ))}
    </nav>
  );
}

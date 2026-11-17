"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Bell, LogOut, Settings, UserCircle, ShieldHalf } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarNav } from "./sidebar-nav";
import { logoutAction } from "@/actions/auth/logout";

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function Topbar({
  user,
  unreadCount = 0,
}: {
  user: { firstName: string; lastName: string; email: string; role?: string };
  unreadCount?: number;
}) {
  const isStaff = !!user.role && user.role !== "CUSTOMER";
  const [, startLogoutTransition] = useTransition();

  function onLogout() {
    startLogoutTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <header className="border-border bg-background/80 sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-lg sm:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full max-w-xs p-0">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-left">
              <Image src="/logo-mark.png" alt="" width={28} height={28} className="size-7" />
              Meridian Bank
            </SheetTitle>
          </SheetHeader>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" aria-label="Notifications" asChild className="relative">
        <Link href="/dashboard/notifications">
          <Bell />
          {unreadCount > 0 && (
            <span className="bg-danger absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 transition-colors hover:bg-muted" aria-label="Account menu">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/10 text-primary-hover text-xs font-medium">
                {initialsOf(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {user.firstName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-foreground-muted truncate text-xs">{user.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <UserCircle />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <Settings />
              Settings
            </Link>
          </DropdownMenuItem>
          {isStaff && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldHalf />
                Admin panel
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onLogout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

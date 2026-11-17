"use client";

import { useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, LogOut, ArrowLeftRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { AdminSidebarNav } from "./admin-sidebar-nav";
import { logoutAction } from "@/actions/auth/logout";

const ROLE_LABEL: Record<string, string> = {
  SUPPORT_AGENT: "Support Agent",
  AUDITOR: "Auditor",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function AdminTopbar({
  user,
}: {
  user: { firstName: string; lastName: string; email: string; role: string };
}) {
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
              Meridian Admin
            </SheetTitle>
          </SheetHeader>
          <AdminSidebarNav role={user.role} />
        </SheetContent>
      </Sheet>

      <Badge variant="outline" className="hidden sm:inline-flex">
        {ROLE_LABEL[user.role] ?? user.role}
      </Badge>

      <div className="flex-1" />

      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link href="/dashboard">
          <ArrowLeftRight className="size-4" />
          Customer view
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full pr-2 pl-1 py-1 transition-colors hover:bg-muted"
            aria-label="Account menu"
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/10 text-primary-hover text-xs font-medium">
                {initialsOf(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">{user.firstName}</span>
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
          <DropdownMenuItem variant="destructive" onSelect={onLogout}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Personal Banking", href: "/personal-banking" },
  { label: "Business Banking", href: "/business-banking" },
  { label: "Loans", href: "/loans" },
  { label: "Credit Cards", href: "/credit-cards" },
  { label: "Investments", href: "/investments" },
  { label: "Support", href: "/support" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60"
          : "border-b border-transparent bg-background"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" priority />
          Meridian Bank
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-foreground-secondary hover:text-foreground hover:bg-muted rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="text-foreground-muted mr-1 flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5" />
            FDIC-style insured, mock platform
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="font-semibold shadow-sm shadow-primary/20">
            <Link href="/signup">Open account</Link>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-xs">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-left">
                <Image src="/logo-mark.png" alt="" width={28} height={28} className="size-7" />
                Meridian Bank
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-foreground hover:bg-muted rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2 px-4">
              <Button asChild variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Open account</Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

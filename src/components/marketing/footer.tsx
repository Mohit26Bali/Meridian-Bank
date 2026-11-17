import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

const FOOTER_LINKS = {
  Banking: [
    { label: "Personal Banking", href: "/personal-banking" },
    { label: "Business Banking", href: "/business-banking" },
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Loans", href: "/loans" },
    { label: "Investments", href: "/investments" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Careers", href: "/careers" },
    { label: "Support", href: "/support" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Security", href: "/security" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" />
              Meridian Bank
            </Link>
            <p className="text-foreground-secondary mt-4 max-w-xs text-sm">
              Modern banking with instant transfers, smart accounts, and
              investments &mdash; built on security you can trust.
            </p>
            <div className="text-foreground-muted mt-6 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-3.5" />
              Demonstration platform &mdash; no real funds are moved.
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold">{section}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-foreground-secondary hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-foreground-muted mt-12 flex flex-col gap-4 border-t border-border pt-8 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Meridian Bank. All rights reserved.</p>
          <p>Meridian Bank is a demonstration product. Not a real financial institution.</p>
        </div>
      </div>
    </footer>
  );
}

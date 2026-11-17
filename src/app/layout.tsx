import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { SkipLink } from "@/components/skip-link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SITE_DESCRIPTION =
  "Modern, secure banking. Instant transfers, smart accounts, and investments in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Meridian Bank",
    template: "%s | Meridian Bank",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Meridian Bank",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    siteName: "Meridian Bank",
    title: "Meridian Bank",
    description: SITE_DESCRIPTION,
    url: APP_URL,
    images: [{ url: "/opengraph-image" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meridian Bank",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the nonce here is what tells Next.js to stamp it onto every
  // script tag it emits (including its own hydration bootstrap) — without
  // this read, the CSP nonce set in middleware.ts never reaches any script
  // tag, and every script on the page gets silently blocked by the browser.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} data-csp-nonce={nonce}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}

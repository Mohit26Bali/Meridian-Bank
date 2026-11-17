import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Credit Cards",
  description:
    "Physical and virtual debit cards with instant freeze, spending limits, and one-tap payment toggles.",
};

export default function CreditCardsPage() {
  return (
    <ComingSoon
      icon={CreditCard}
      phase="Coming in Phase 5"
      title="Cards, built for control"
      description="Physical and virtual debit cards with instant freeze, spending limits, and one-tap toggles for online and international payments."
    />
  );
}

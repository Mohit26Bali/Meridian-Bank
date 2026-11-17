import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Loans",
  description:
    "Compare personal, auto, and home loan offers side by side, apply in minutes, and track every repayment.",
};

export default function LoansPage() {
  return (
    <ComingSoon
      icon={Landmark}
      phase="Coming in Phase 5"
      title="Loan Marketplace"
      description="Compare personal, auto, and home loan offers side by side, apply in minutes, and track every repayment from your dashboard."
    />
  );
}

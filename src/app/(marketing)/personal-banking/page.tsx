import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Personal Banking",
  description:
    "Checking, savings, and salary accounts with instant transfers and real-time spending insights.",
};

export default function PersonalBankingPage() {
  return (
    <ComingSoon
      icon={Wallet}
      phase="Coming in a later phase"
      title="Personal Banking"
      description="Checking, savings, and salary accounts with instant transfers and real-time spending insights — arriving alongside the full account dashboard."
    />
  );
}

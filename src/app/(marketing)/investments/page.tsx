import type { Metadata } from "next";
import { LineChart } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Investments",
  description:
    "Mutual funds, fixed and recurring deposits, and stocks, tracked alongside your everyday accounts.",
};

export default function InvestmentsPage() {
  return (
    <ComingSoon
      icon={LineChart}
      phase="Coming in Phase 5"
      title="Grow what you save"
      description="Mutual funds, fixed and recurring deposits, and stocks, tracked alongside your everyday accounts with clear, simulated returns."
    />
  );
}

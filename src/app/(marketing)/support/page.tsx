import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with your Meridian Bank account, transfers, cards, and more.",
};

export default function SupportPage() {
  return (
    <ComingSoon
      icon={LifeBuoy}
      phase="Coming in Phase 6"
      title="We're here around the clock"
      description="A dedicated support ticketing system with real-time status updates. In the meantime, security or account issues can be reported at security@meridianbank.example."
    />
  );
}

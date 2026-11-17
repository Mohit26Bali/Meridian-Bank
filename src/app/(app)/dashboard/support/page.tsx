import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";
import { ComingSoonCard } from "@/components/app/coming-soon-card";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <ComingSoonCard
      icon={LifeBuoy}
      phase="Coming in Phase 6"
      title="Support"
      description="A full support ticketing system with real-time status updates. For now, reach us at security@meridianbank.example."
    />
  );
}

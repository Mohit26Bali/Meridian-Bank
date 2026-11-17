import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { ComingSoon } from "@/components/marketing/coming-soon";

export const metadata: Metadata = {
  title: "Business Banking",
  description:
    "Multi-user business accounts with role-based permissions, invoicing, and bulk payments.",
};

export default function BusinessBankingPage() {
  return (
    <ComingSoon
      icon={Building2}
      phase="Coming in a later phase"
      title="Business Banking"
      description="Multi-user business accounts with role-based permissions, invoicing, and bulk payments — built on the same security foundation as personal accounts."
    />
  );
}

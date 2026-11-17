"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Lock, FileCheck2, Fingerprint, Radar } from "lucide-react";

const BADGES = [
  { icon: ShieldCheck, label: "PCI DSS", sub: "Level 1 compliant" },
  { icon: FileCheck2, label: "SOC 2 Type II", sub: "Audited annually" },
  { icon: Fingerprint, label: "ISO 27001", sub: "Certified controls" },
  { icon: Lock, label: "AES-256", sub: "Encryption at rest" },
  { icon: Radar, label: "24/7 Monitoring", sub: "Real-time fraud alerts" },
];

export function TrustBadges() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
      >
        {BADGES.map((badge) => (
          <div
            key={badge.label}
            className="border-border bg-card flex flex-col items-center gap-2 rounded-2xl border px-4 py-6 text-center"
          >
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
              <badge.icon className="size-5" />
            </div>
            <p className="text-sm font-semibold">{badge.label}</p>
            <p className="text-foreground-muted text-xs">{badge.sub}</p>
          </div>
        ))}
      </motion.div>
      <p className="text-foreground-muted mt-4 text-center text-xs">
        Mock certifications for demonstration purposes &mdash; Meridian Bank is not a real financial institution.
      </p>
    </section>
  );
}

"use client";

import { motion } from "framer-motion";
import {
  Zap,
  ShieldCheck,
  Clock,
  LineChart,
  Landmark,
} from "lucide-react";

const FEATURES = [
  {
    icon: Zap,
    title: "Instant transfers",
    description:
      "Send and receive money in seconds, not days. Free between Meridian accounts, transparent fees everywhere else.",
  },
  {
    icon: ShieldCheck,
    title: "High security",
    description:
      "Argon2 password hashing, device tracking, and 24/7 fraud monitoring keep your money and identity protected.",
  },
  {
    icon: Clock,
    title: "24/7 banking",
    description:
      "Manage accounts, move money, and get support any time — no branch hours, no waiting on hold.",
  },
  {
    icon: LineChart,
    title: "Investment accounts",
    description:
      "Grow your savings with mutual funds, fixed deposits, and stocks, tracked alongside your everyday spending.",
  },
  {
    icon: Landmark,
    title: "Loan marketplace",
    description:
      "Compare personal, auto, and home loan offers side by side, and track every repayment in one dashboard.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything a modern bank should be.
        </h2>
        <p className="text-foreground-secondary mt-4 text-lg">
          Designed around the moments that matter &mdash; getting paid,
          paying others, and growing what&apos;s left.
        </p>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: index * 0.06 }}
            className="group rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-black/5"
          >
            <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
              <feature.icon className="size-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
            <p className="text-foreground-secondary mt-2 text-sm leading-relaxed">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

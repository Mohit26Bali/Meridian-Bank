"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "@/components/marketing/animated-number";

const STATS = [
  { value: 12, suffix: "B+", prefix: "$", label: "Transactions processed" },
  { value: 4.2, suffix: "M+", label: "Customers banking with us" },
  { value: 18, label: "Years in business" },
  { value: 99.99, suffix: "%", label: "Platform uptime" },
];

export function TrustedBy() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-8 lg:grid-cols-4"
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
                <AnimatedNumber
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.value % 1 !== 0 ? 2 : 0}
                />
              </p>
              <p className="text-foreground-secondary mt-1 text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

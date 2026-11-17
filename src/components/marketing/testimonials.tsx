"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TESTIMONIALS = [
  {
    name: "Priya Shankar",
    role: "Freelance designer",
    initials: "PS",
    quote:
      "Switching my business account over took fifteen minutes and I've never once had to think about whether a transfer actually went through.",
  },
  {
    name: "Marcus Webb",
    role: "Small business owner",
    initials: "MW",
    quote:
      "The loan marketplace let me compare real offers side by side instead of guessing. Approved and funded within a week.",
  },
  {
    name: "Elena Torres",
    role: "Product manager",
    initials: "ET",
    quote:
      "Security notifications actually mean something here — I get an alert the moment a new device touches my account.",
  },
];

export function Testimonials() {
  return (
    <section className="bg-card border-y border-border">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Trusted by people who move fast.
          </h2>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, index) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="bg-background flex flex-col rounded-2xl border border-border p-6"
            >
              <div className="text-warning flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-foreground-secondary mt-4 flex-1 text-sm leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary-hover text-xs font-medium">
                    {t.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-foreground-muted text-xs">{t.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

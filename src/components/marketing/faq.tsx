"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    question: "Is my money actually insured?",
    answer:
      "This is a demonstration platform using simulated banking data — no real funds are held or moved. In a production deployment, deposit accounts would carry standard deposit insurance up to the applicable limit.",
  },
  {
    question: "How fast are transfers between accounts?",
    answer:
      "Transfers between Meridian accounts post instantly. External transfers to other banks typically settle within one business day, and you can track status in real time from your dashboard.",
  },
  {
    question: "What happens if I lose my phone or laptop?",
    answer:
      "Every session is tied to a tracked device. From Settings, you can view active sessions and revoke access from any device instantly, and we'll flag unfamiliar sign-ins automatically.",
  },
  {
    question: "Do you run a credit check to open an account?",
    answer:
      "Opening a checking or savings account doesn't require a credit check. Certain products, like credit cards and loans, do require identity verification and a soft or hard credit check depending on the product.",
  },
  {
    question: "Can I use Meridian for my business?",
    answer:
      "Yes — Business Banking supports multiple team members, role-based permissions, and dedicated invoicing tools alongside the same instant transfers and security features.",
  },
];

export function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
        <p className="text-foreground-secondary mt-4 text-lg">
          Can&apos;t find what you&apos;re looking for? Our support team is
          available around the clock.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-10"
      >
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-foreground-secondary text-sm leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
}

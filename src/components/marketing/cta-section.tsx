"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Star, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="bg-primary relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(255,255,255,0.16),transparent)]"
        />
        <h2 className="text-primary-foreground relative text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready to bank differently?
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-white">
          Open an account in minutes. No branch visits, no paperwork, no
          waiting.
        </p>
        <div className="relative mt-8 flex justify-center">
          <Button asChild size="lg" variant="secondary" className="group">
            <Link href="/signup">
              Open an account
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-white">
          <div className="flex items-center gap-1.5">
            <span className="flex text-warning">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3.5 fill-current" />
              ))}
            </span>
            Trusted by 2M+ customers
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" />
            FDIC-style insured (mock)
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="size-4 fill-current text-warning" />
            4.9/5 app rating
          </div>
        </div>
      </motion.div>
    </section>
  );
}

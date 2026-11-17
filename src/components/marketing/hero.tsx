"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Lock, CreditCard, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/marketing/animated-number";

export function Hero() {
  const cardRef = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });
  const transformStyle = useMotionTemplate`rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * 6);
    rotateX.set(py * -6);
  }

  function onMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="bg-noise pointer-events-none absolute inset-0 -z-20" />
      <div
        aria-hidden
        className="bg-grid-pattern pointer-events-none absolute inset-0 -z-10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(55% 45% at 50% 0%, color-mix(in oklab, var(--color-primary) 10%, transparent), transparent), radial-gradient(35% 35% at 85% 15%, color-mix(in oklab, var(--color-accent-cyan) 8%, transparent), transparent)",
        }}
      />
      <div
        aria-hidden
        className="bg-accent-cyan/25 absolute top-24 right-[8%] -z-10 size-64 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="bg-primary/15 absolute top-64 left-[4%] -z-10 size-72 rounded-full blur-3xl"
      />

      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-32 lg:pb-28 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="text-primary bg-primary/10 mb-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <ShieldCheck className="size-3.5" />
            Bank-grade security, built in from day one
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Bank smarter.{" "}
            <span className="bg-linear-to-r from-primary via-primary to-accent-cyan bg-clip-text text-transparent">
              Move money faster.
            </span>
          </h1>

          <p className="text-foreground-secondary mt-6 max-w-lg text-lg text-balance">
            Instant transfers, smart accounts, and investments &mdash; all in
            one place, protected by security that never sleeps.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="group">
              <Link href="/signup">
                Open an account
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#features">Learn more</Link>
            </Button>
          </div>

          <div className="text-foreground-secondary mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Zap className="text-primary size-4" />
              Instant transfers
            </div>
            <div className="flex items-center gap-2">
              <Lock className="text-primary size-4" />
              256-bit encryption
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-primary size-4" />
              24/7 fraud monitoring
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="relative mx-auto w-full max-w-md [perspective:1200px]"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <motion.div
            ref={cardRef}
            style={{ transform: transformStyle }}
            className="border-border bg-card/95 relative rounded-2xl border p-6 shadow-2xl shadow-black/10 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground-secondary text-xs">Total balance</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  <AnimatedNumber value={48204.12} prefix="$" decimals={2} />
                </p>
              </div>
              <span className="bg-success/10 text-success rounded-full px-2.5 py-1 text-xs font-medium">
                +2.4% this month
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {[
                { label: "Everyday Checking", value: 12480.32, tone: "primary" },
                { label: "High-Yield Savings", value: 31204.8, tone: "accent-cyan" },
                { label: "Investment Portfolio", value: 4519.0, tone: "warning" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="border-border flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: `var(--color-${row.tone})` }}
                    />
                    <span className="text-sm font-medium">{row.label}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    <AnimatedNumber value={row.value} prefix="$" decimals={2} />
                  </span>
                </div>
              ))}
            </div>

            <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="bg-primary size-6 rounded-full" />
                <span className="text-foreground-secondary">
                  Transfer to Alex &mdash; instant
                </span>
              </div>
              <span className="text-success text-xs font-semibold">Sent</span>
            </div>
          </motion.div>

          {/* Floating credit card */}
          <motion.div
            initial={{ opacity: 0, y: 10, rotate: -6 }}
            animate={{ opacity: 1, y: 0, rotate: -6 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
            whileHover={{ rotate: -3, scale: 1.03 }}
            className="from-primary to-accent-cyan absolute -top-24 -left-16 hidden h-24 w-40 rounded-xl bg-linear-to-br p-3 text-white shadow-xl shadow-black/20 sm:block"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium tracking-wide opacity-80">
                MERIDIAN
              </span>
              <CreditCard className="size-4 opacity-80" />
            </div>
            <p className="mt-4 font-mono text-xs tracking-widest opacity-90">
              •••• •••• •••• 4821
            </p>
          </motion.div>

          {/* Floating analytics card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.45 }}
            className="border-border bg-card absolute -right-10 -top-20 hidden w-36 rounded-xl border p-3 shadow-xl shadow-black/10 sm:block"
          >
            <div className="flex items-center gap-1.5">
              <TrendingUp className="text-accent size-3.5" />
              <span className="text-foreground-secondary text-[10px] font-medium">
                Portfolio
              </span>
            </div>
            <svg viewBox="0 0 100 32" className="mt-2 h-8 w-full">
              <polyline
                points="0,26 15,20 30,22 45,12 60,15 75,6 100,2"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-accent mt-1 text-xs font-semibold">+12.8%</p>
          </motion.div>

          <div
            aria-hidden
            className="bg-accent-cyan/20 absolute -right-6 -bottom-6 -z-10 size-32 rounded-full blur-2xl"
          />
          <div
            aria-hidden
            className="bg-primary/20 absolute -bottom-8 -left-8 -z-10 size-40 rounded-full blur-2xl"
          />
        </motion.div>
      </div>
    </section>
  );
}

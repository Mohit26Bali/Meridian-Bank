import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-28 text-center sm:px-6 lg:px-8">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
        <Icon className="size-6" />
      </div>
      <Badge variant="secondary" className="mt-6">
        {phase}
      </Badge>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="text-foreground-secondary mt-4 text-lg text-balance">
        {description}
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/signup">Open an account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </section>
  );
}

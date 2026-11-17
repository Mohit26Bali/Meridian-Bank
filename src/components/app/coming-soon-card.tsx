import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoonCard({
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <Icon className="size-6" />
          </div>
          <Badge variant="secondary">{phase}</Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-foreground-secondary mt-2 text-sm text-balance">
              {description}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

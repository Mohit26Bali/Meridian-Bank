import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <div className="bg-muted flex size-11 items-center justify-center rounded-xl">
        <Icon className="text-foreground-muted size-5" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-foreground-secondary mt-1 max-w-sm text-sm">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

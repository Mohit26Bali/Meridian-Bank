"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, ArrowLeftRight, Tag, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/banking/format";
import { markNotificationReadAction } from "@/actions/notifications";

const CATEGORY_ICON: Record<string, typeof ShieldAlert> = {
  SECURITY: ShieldAlert,
  TRANSACTION: ArrowLeftRight,
  OFFER: Tag,
  SYSTEM: Info,
};

const CATEGORY_TONE: Record<string, string> = {
  SECURITY: "bg-danger/10 text-danger",
  TRANSACTION: "bg-primary/10 text-primary",
  OFFER: "bg-warning/10 text-warning",
  SYSTEM: "bg-muted text-foreground-secondary",
};

interface NotificationRowProps {
  id: string;
  category: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export function NotificationRow({ id, category, title, body, createdAt, readAt }: NotificationRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const Icon = CATEGORY_ICON[category] ?? Info;

  function onClick() {
    if (readAt || isPending) return;
    startTransition(async () => {
      await markNotificationReadAction(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-muted",
        !readAt && "bg-primary/5"
      )}
    >
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", CATEGORY_TONE[category])}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          {!readAt && <span className="bg-primary size-1.5 shrink-0 rounded-full" />}
        </div>
        <p className="text-foreground-secondary mt-0.5 text-sm">{body}</p>
        <p className="text-foreground-muted mt-1 text-xs">{formatDate(createdAt)}</p>
      </div>
    </button>
  );
}

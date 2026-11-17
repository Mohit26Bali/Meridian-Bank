"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/actions/notifications";

export function MarkAllReadButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={isPending}>
      {isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
      Mark all read
    </Button>
  );
}

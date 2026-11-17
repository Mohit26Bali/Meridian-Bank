"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Loader2, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/banking/format";
import { revokeSessionAction } from "@/actions/security";

interface SessionRowProps {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  updatedAt: string;
  expiresAt: string;
}

export function SessionRow({ id, isCurrent, ipAddress, userAgent, updatedAt }: SessionRowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="bg-muted flex size-9 items-center justify-center rounded-full">
          <Laptop className="text-foreground-secondary size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{ipAddress ?? "Unknown IP"}</p>
            {isCurrent && <Badge variant="secondary">This device</Badge>}
          </div>
          <p className="text-foreground-muted max-w-xs truncate text-xs">
            {userAgent ?? "Unknown device"} &middot; Active {formatDate(updatedAt)}
          </p>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      </div>
      {!isCurrent && (
        <Button size="sm" variant="ghost" onClick={onRevoke} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
          Sign out
        </Button>
      )}
    </div>
  );
}

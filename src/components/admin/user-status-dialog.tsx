"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateUserStatusAction } from "@/actions/admin/users";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "LOCKED", label: "Locked" },
  { value: "CLOSED", label: "Closed" },
];

export function UserStatusDialog({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updateUserStatusAction({
        userId,
        status: status as "ACTIVE" | "SUSPENDED" | "LOCKED" | "CLOSED",
        reason: reason || undefined,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setReason("");
          setStatus(currentStatus);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldAlert />
          Change status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change account status</DialogTitle>
          <DialogDescription>
            The customer will be notified of this change.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="new-status-trigger">New status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="new-status-trigger" className="w-full" aria-label="New status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status-reason">Reason (optional)</Label>
          <Textarea
            id="status-reason"
            placeholder="e.g. Suspicious login activity reported by customer"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={onSubmit}
            disabled={isPending || status === currentStatus}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

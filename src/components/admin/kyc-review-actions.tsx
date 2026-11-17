"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { reviewKycAction } from "@/actions/admin/kyc";

export function KycReviewActions({ kycId }: { kycId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    setError(null);
    startTransition(async () => {
      const result = await reviewKycAction({ kycId, decision: "VERIFIED" });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function reject() {
    setError(null);
    startTransition(async () => {
      const result = await reviewKycAction({
        kycId,
        decision: "REJECTED",
        rejectionReason: reason,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRejectOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={approve} disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Check />}
          Approve
        </Button>
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={isPending}>
              <X />
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject KYC submission</DialogTitle>
              <DialogDescription>
                Tell the customer what needs to be corrected before resubmitting.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="e.g. PAN document image is blurry and unreadable"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <DialogFooter>
              <Button
                variant="destructive"
                className="w-full"
                onClick={reject}
                disabled={isPending || !reason.trim()}
              >
                {isPending && <Loader2 className="animate-spin" />}
                Reject submission
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

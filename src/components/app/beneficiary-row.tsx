"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  verifyBeneficiaryAction,
  removeBeneficiaryAction,
} from "@/actions/banking/beneficiaries";
import { maskAccountNumber } from "@/lib/banking/format";

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  VERIFIED: "secondary",
  PENDING_VERIFICATION: "outline",
  REJECTED: "destructive",
  BLOCKED: "destructive",
};

interface BeneficiaryRowProps {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  status: string;
}

export function BeneficiaryRow({
  id,
  nickname,
  bankName,
  accountNumber,
  ifsc,
  status,
}: BeneficiaryRowProps) {
  const router = useRouter();
  const [isVerifying, startVerify] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onVerify() {
    setError(null);
    startVerify(async () => {
      const result = await verifyBeneficiaryAction(id);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    startRemove(async () => {
      const result = await removeBeneficiaryAction(id);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
            <Landmark className="size-5" />
          </div>
          <div>
            <p className="font-medium">{nickname}</p>
            <p className="text-foreground-muted text-xs">
              {bankName} &middot; {maskAccountNumber(accountNumber)} &middot; {ifsc}
            </p>
            {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status.replace("_", " ")}</Badge>
          {status === "PENDING_VERIFICATION" && (
            <Button size="sm" variant="outline" onClick={onVerify} disabled={isVerifying}>
              {isVerifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Verify
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove payee"
            onClick={onRemove}
            disabled={isRemoving}
          >
            {isRemoving ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

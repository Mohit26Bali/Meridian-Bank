"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2, Snowflake, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  maskAccountNumber,
} from "@/lib/banking/format";
import { freezeCardAction, unfreezeCardAction, replaceCardAction } from "@/actions/banking/cards";
import { ChangePinDialog } from "./change-pin-dialog";
import { CardControlsDialog } from "./card-controls-dialog";
import { CardRevealDialog, type RevealedCard } from "./card-reveal-dialog";

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  ACTIVE: "secondary",
  FROZEN: "outline",
  BLOCKED: "destructive",
  EXPIRED: "destructive",
};

interface CardItemProps {
  id: string;
  type: string;
  status: string;
  lastFour: string;
  expiryMonth: number;
  expiryYear: number;
  dailyLimit: string;
  onlinePaymentsEnabled: boolean;
  internationalEnabled: boolean;
  accountType: string;
  accountNumber: string;
}

export function CardItem({
  id,
  type,
  status,
  lastFour,
  expiryMonth,
  expiryYear,
  dailyLimit,
  onlinePaymentsEnabled,
  internationalEnabled,
  accountType,
  accountNumber,
}: CardItemProps) {
  const router = useRouter();
  const [isToggling, startToggle] = useTransition();
  const [isReplacing, startReplace] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedCard | null>(null);

  function onToggleFreeze() {
    setError(null);
    startToggle(async () => {
      const result =
        status === "ACTIVE" ? await freezeCardAction(id) : await unfreezeCardAction(id);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function onReplace() {
    setError(null);
    startReplace(async () => {
      const result = await replaceCardAction(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setRevealed(result.card);
    });
  }

  const isUsable = status === "ACTIVE" || status === "FROZEN";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div
          className="w-full max-w-xs rounded-xl p-4 text-primary-foreground sm:w-72"
          style={{
            background:
              status === "ACTIVE"
                ? "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))"
                : "linear-gradient(135deg, var(--color-foreground-muted), var(--color-foreground-secondary))",
          }}
        >
          <div className="flex items-center justify-between">
            <CreditCard className="size-6" />
            <span className="text-xs font-medium">
              {type === "DEBIT_VIRTUAL" ? "Virtual" : "Physical"}
            </span>
          </div>
          <p className="mt-6 font-mono text-lg tracking-widest">•••• {lastFour}</p>
          <div className="mt-3 flex items-center justify-between text-xs text-white">
            <span>
              {ACCOUNT_TYPE_LABEL[accountType] ?? accountType}{" "}
              {maskAccountNumber(accountNumber)}
            </span>
            <span className="font-mono">
              {String(expiryMonth).padStart(2, "0")}/{String(expiryYear).slice(-2)}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>
            <span className="text-foreground-muted text-xs">
              Daily limit {formatCurrency(dailyLimit)}
            </span>
          </div>
          <div className="text-foreground-muted flex gap-3 text-xs">
            <span>Online {onlinePaymentsEnabled ? "on" : "off"}</span>
            <span>International {internationalEnabled ? "on" : "off"}</span>
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        {isUsable && (
          <Button size="sm" variant="outline" onClick={onToggleFreeze} disabled={isToggling}>
            {isToggling ? <Loader2 className="animate-spin" /> : <Snowflake />}
            {status === "ACTIVE" ? "Freeze" : "Unfreeze"}
          </Button>
        )}
        {isUsable && <ChangePinDialog cardId={id} />}
        {isUsable && (
          <CardControlsDialog
            cardId={id}
            dailyLimit={dailyLimit}
            onlinePaymentsEnabled={onlinePaymentsEnabled}
            internationalEnabled={internationalEnabled}
          />
        )}
        {isUsable && (
          <Button size="sm" variant="outline" onClick={onReplace} disabled={isReplacing}>
            {isReplacing ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
            Replace
          </Button>
        )}
      </div>

      <CardRevealDialog
        card={revealed}
        onClose={() => {
          setRevealed(null);
          router.refresh();
        }}
      />
    </div>
  );
}

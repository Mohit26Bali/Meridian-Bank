"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LineChart, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withdrawInvestmentAction } from "@/actions/banking/investments";
import { formatWithdrawalNotice, INVESTMENT_TERMS } from "@/lib/banking/investments";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  formatDate,
  maskAccountNumber,
} from "@/lib/banking/format";

const TYPE_LABEL: Record<string, string> = {
  MUTUAL_FUND: "Mutual Fund",
  FIXED_DEPOSIT: "Fixed Deposit",
  RECURRING_DEPOSIT: "Recurring Deposit",
  STOCK: "Stocks",
};

const STATUS_VARIANT: Record<string, "secondary" | "outline"> = {
  ACTIVE: "secondary",
  MATURED: "secondary",
  WITHDRAWN: "outline",
  CANCELLED: "outline",
};

interface InvestmentRowProps {
  id: string;
  type: string;
  status: string;
  principal: string;
  currentValue: number;
  startDate: string;
  maturityDate: string | null;
  accounts: { id: string; accountType: string; accountNumber: string }[];
}

export function InvestmentRow({
  id,
  type,
  status,
  principal,
  currentValue,
  startDate,
  maturityDate,
  accounts,
}: InvestmentRowProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const returns = currentValue - Number(principal);
  const isPositive = returns >= 0;
  const isEarly = Boolean(maturityDate && new Date() < new Date(maturityDate));
  const terms = INVESTMENT_TERMS[type];
  const notice = isEarly ? formatWithdrawalNotice(terms.earlyWithdrawalPenaltyPercent) : null;

  function onWithdraw() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawInvestmentAction({ investmentId: id, accountId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
            <LineChart className="size-5" />
          </div>
          <div>
            <p className="font-medium">{TYPE_LABEL[type] ?? type}</p>
            <p className="text-foreground-muted text-xs">
              Invested {formatCurrency(principal)} &middot; {formatDate(startDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(currentValue)}</p>
            <p
              className={
                isPositive
                  ? "text-success flex items-center justify-end gap-0.5 text-xs"
                  : "text-destructive flex items-center justify-end gap-0.5 text-xs"
              }
            >
              {isPositive ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {formatCurrency(Math.abs(returns))}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status}</Badge>

          {status === "ACTIVE" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw investment</DialogTitle>
                  <DialogDescription>
                    Current value {formatCurrency(currentValue)} will be paid
                    out to the account you choose.
                  </DialogDescription>
                </DialogHeader>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {notice && (
                  <Alert>
                    <AlertDescription>{notice}</AlertDescription>
                  </Alert>
                )}

                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {ACCOUNT_TYPE_LABEL[a.accountType] ?? a.accountType}{" "}
                        {maskAccountNumber(a.accountNumber)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <DialogFooter>
                  <Button onClick={onWithdraw} disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="animate-spin" />}
                    Confirm withdrawal
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

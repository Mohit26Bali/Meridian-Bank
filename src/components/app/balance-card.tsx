import Link from "next/link";
import { Wallet, PiggyBank, Banknote, Users, Landmark } from "lucide-react";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  maskAccountNumber,
} from "@/lib/banking/format";

const TYPE_ICON: Record<string, typeof Wallet> = {
  SAVINGS: PiggyBank,
  CURRENT: Wallet,
  SALARY: Banknote,
  BUSINESS: Landmark,
  JOINT: Users,
  FIXED_DEPOSIT: PiggyBank,
};

export function BalanceCard({
  id,
  accountType,
  accountNumber,
  balance,
  currency,
}: {
  id: string;
  accountType: string;
  accountNumber: string;
  balance: number | string;
  currency: string;
}) {
  const Icon = TYPE_ICON[accountType] ?? Wallet;

  return (
    <Link
      href={`/dashboard/accounts/${id}`}
      className="group border-border bg-card hover:shadow-md hover:shadow-black/5 flex flex-col justify-between rounded-2xl border p-5 transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </div>
        <span className="text-foreground-muted text-xs">
          {maskAccountNumber(accountNumber)}
        </span>
      </div>
      <div className="mt-5">
        <p className="text-foreground-secondary text-xs">
          {ACCOUNT_TYPE_LABEL[accountType] ?? accountType}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          {formatCurrency(balance, currency)}
        </p>
      </div>
    </Link>
  );
}

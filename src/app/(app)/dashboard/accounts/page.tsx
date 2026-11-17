import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Wallet } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/lib/banking/queries";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  formatDate,
  maskAccountNumber,
} from "@/lib/banking/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";

export const metadata: Metadata = { title: "Accounts" };

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  ACTIVE: "secondary",
  DORMANT: "outline",
  FROZEN: "destructive",
  CLOSED: "destructive",
};

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const accounts = await getAccountsForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          All of your Meridian accounts in one place.
        </p>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Your accounts are opened automatically once your email is verified."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => (
            <Link key={account.id} href={`/dashboard/accounts/${account.id}`}>
              <Card className="hover:shadow-md hover:shadow-black/5 transition-shadow">
                <CardContent className="flex items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                      <Wallet className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
                      </p>
                      <p className="text-foreground-muted text-xs">
                        {maskAccountNumber(account.accountNumber)} &middot; Opened{" "}
                        {formatDate(account.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(account.balance.toString(), account.currency)}
                      </p>
                      <Badge
                        variant={STATUS_VARIANT[account.status] ?? "outline"}
                        className="mt-1"
                      >
                        {account.status}
                      </Badge>
                    </div>
                    <ChevronRight className="text-foreground-muted size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

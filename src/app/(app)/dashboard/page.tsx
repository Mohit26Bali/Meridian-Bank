import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { ArrowRight, Receipt } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getAccountsForUser,
  getRecentTransactionsForUser,
  getMonthlyActivityForUser,
} from "@/lib/banking/queries";
import { formatCurrency } from "@/lib/banking/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BalanceCard } from "@/components/app/balance-card";
import { QuickActions } from "@/components/app/quick-actions";
import { TransactionRow } from "@/components/app/transaction-row";
import { EmptyState } from "@/components/app/empty-state";
import { FadeIn } from "@/components/fade-in";
const ActivityChart = dynamic(() =>
  import("@/components/app/activity-chart").then((mod) => mod.ActivityChart)
, { loading: () => <Skeleton className="h-64 w-full" /> });

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [accounts, recentTransactions, monthlyActivity] = await Promise.all([
    getAccountsForUser(user.id),
    getRecentTransactionsForUser(user.id, 5),
    getMonthlyActivityForUser(user.id),
  ]);

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const hasActivity = monthlyActivity.some((m) => m.income > 0 || m.expense > 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {user.firstName}
        </h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          Here&apos;s what&apos;s happening across your accounts.
        </p>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-2">
            <div>
              <p className="text-sm text-white">Total balance</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {formatCurrency(totalBalance)}
              </p>
            </div>
            <p className="text-sm text-white">
              Across {accounts.length} account{accounts.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1}>
        <QuickActions
          accounts={accounts.map((a) => ({
            id: a.id,
            accountType: a.accountType,
            accountNumber: a.accountNumber,
          }))}
        />
      </FadeIn>

      <FadeIn delay={0.15} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <BalanceCard
            key={account.id}
            id={account.id}
            accountType={account.accountType}
            accountNumber={account.accountNumber}
            balance={account.balance.toString()}
            currency={account.currency}
          />
        ))}
      </FadeIn>

      <FadeIn delay={0.2} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account activity</CardTitle>
          </CardHeader>
          <CardContent>
            {hasActivity ? (
              <ActivityChart data={monthlyActivity} />
            ) : (
              <EmptyState
                icon={Receipt}
                title="No activity yet"
                description="Make a mock deposit to see your account activity appear here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent transactions</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/transactions">
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions yet"
                description="Your transaction history will show up here once money moves."
              />
            ) : (
              recentTransactions.map((tx) => {
                const isIncoming = accounts.some(
                  (a) => a.id === tx.receiverAccountId
                );
                return (
                  <TransactionRow
                    key={tx.id}
                    id={tx.id}
                    type={tx.type}
                    status={tx.status}
                    amount={tx.amount.toString()}
                    description={tx.description}
                    createdAt={tx.createdAt}
                    referenceNumber={tx.referenceNumber}
                    isIncoming={isIncoming}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

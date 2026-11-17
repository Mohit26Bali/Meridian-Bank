import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountForUser } from "@/lib/banking/queries";
import { prisma } from "@/lib/db/prisma";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  formatDate,
} from "@/lib/banking/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionRow } from "@/components/app/transaction-row";
import { EmptyState } from "@/components/app/empty-state";

export const metadata: Metadata = { title: "Account details" };

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  ACTIVE: "secondary",
  DORMANT: "outline",
  FROZEN: "destructive",
  CLOSED: "destructive",
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { accountId } = await params;
  const account = await getAccountForUser(user.id, accountId);
  if (!account) notFound();

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ senderAccountId: account.id }, { receiverAccountId: account.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/accounts"
        className="text-foreground-secondary hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        All accounts
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-6 py-2">
          <div>
            <p className="text-foreground-secondary text-sm">
              {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatCurrency(account.balance.toString(), account.currency)}
            </p>
            <Badge variant={STATUS_VARIANT[account.status] ?? "outline"} className="mt-3">
              {account.status}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Account number</dt>
            <dd className="font-mono">{account.accountNumber}</dd>
            <dt className="text-foreground-muted">IFSC</dt>
            <dd className="font-mono">{account.ifsc}</dd>
            <dt className="text-foreground-muted">Currency</dt>
            <dd>{account.currency}</dd>
            <dt className="text-foreground-muted">Opened</dt>
            <dd>{formatDate(account.createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {transactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Transactions on this account will appear here."
            />
          ) : (
            transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                id={tx.id}
                type={tx.type}
                status={tx.status}
                amount={tx.amount.toString()}
                description={tx.description}
                createdAt={tx.createdAt}
                referenceNumber={tx.referenceNumber}
                isIncoming={tx.receiverAccountId === account.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

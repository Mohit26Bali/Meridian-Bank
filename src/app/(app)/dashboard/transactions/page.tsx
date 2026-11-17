import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser, getTransactionsForUser } from "@/lib/banking/queries";
import {
  ACCOUNT_TYPE_LABEL,
  maskAccountNumber,
} from "@/lib/banking/format";
import type { TransactionType, TransactionStatus } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { TransactionRow } from "@/components/app/transaction-row";
import { TransactionsFilters } from "@/components/app/transactions-filters";
import { PaginationBar } from "@/components/app/pagination-bar";
import { EmptyState } from "@/components/app/empty-state";

export const metadata: Metadata = { title: "Transactions" };

const PAGE_SIZE = 15;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [accounts, { transactions, total }] = await Promise.all([
    getAccountsForUser(user.id),
    getTransactionsForUser(
      user.id,
      {
        accountId: params.accountId,
        type: params.type as TransactionType | undefined,
        status: params.status as TransactionStatus | undefined,
        search: params.search,
      },
      page,
      PAGE_SIZE
    ),
  ]);

  const accountIds = new Set(accounts.map((a) => a.id));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(nextPage: number) {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    next.set("page", String(nextPage));
    return `/dashboard/transactions?${next.toString()}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          Full history across all of your accounts.
        </p>
      </div>

      <TransactionsFilters
        accounts={accounts.map((a) => ({
          id: a.id,
          label: `${ACCOUNT_TYPE_LABEL[a.accountType] ?? a.accountType} ${maskAccountNumber(a.accountNumber)}`,
        }))}
      />

      <Card>
        <CardContent className="flex flex-col gap-1">
          {transactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions found"
              description="Try adjusting your filters, or make a mock deposit from your dashboard."
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
                isIncoming={
                  !!tx.receiverAccountId && accountIds.has(tx.receiverAccountId)
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}

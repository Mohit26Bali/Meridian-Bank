import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser, getCardsForUser } from "@/lib/banking/queries";
import { EmptyState } from "@/components/app/empty-state";
import { IssueCardDialog } from "@/components/app/issue-card-dialog";
import { CardItem } from "@/components/app/card-item";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [accounts, cards] = await Promise.all([
    getAccountsForUser(user.id),
    getCardsForUser(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cards</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            Manage your debit and virtual cards.
          </p>
        </div>
        <IssueCardDialog
          accounts={accounts.map((a) => ({
            id: a.id,
            accountType: a.accountType,
            accountNumber: a.accountNumber,
          }))}
        />
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No cards yet"
          description="Issue a virtual or physical debit card linked to one of your accounts."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              id={card.id}
              type={card.type}
              status={card.status}
              lastFour={card.cardNumberLastFour}
              expiryMonth={card.expiryMonth}
              expiryYear={card.expiryYear}
              dailyLimit={card.dailyLimit.toString()}
              onlinePaymentsEnabled={card.onlinePaymentsEnabled}
              internationalEnabled={card.internationalEnabled}
              accountType={card.account.accountType}
              accountNumber={card.account.accountNumber}
            />
          ))}
        </div>
      )}
    </div>
  );
}

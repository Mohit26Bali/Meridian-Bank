import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser, getBeneficiariesForUser } from "@/lib/banking/queries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TransferFlow } from "@/components/app/transfer-flow";

export const metadata: Metadata = { title: "Transfer Money" };

export default async function TransferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [accounts, beneficiaries] = await Promise.all([
    getAccountsForUser(user.id),
    getBeneficiariesForUser(user.id),
  ]);

  const verifiedBeneficiaries = beneficiaries.filter((b) => b.status === "VERIFIED");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transfer Money</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          Move money between your own accounts or send it to a saved payee.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New transfer</CardTitle>
          <CardDescription>
            Every transfer is confirmed with a one-time code for your security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TransferFlow
            accounts={accounts.map((a) => ({
              id: a.id,
              accountType: a.accountType,
              accountNumber: a.accountNumber,
              balance: a.balance.toString(),
            }))}
            beneficiaries={verifiedBeneficiaries.map((b) => ({
              id: b.id,
              nickname: b.nickname,
              bankName: b.bankName,
              accountNumber: b.accountNumber,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

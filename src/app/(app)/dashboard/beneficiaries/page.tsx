import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getBeneficiariesForUser } from "@/lib/banking/queries";
import { EmptyState } from "@/components/app/empty-state";
import { AddBeneficiaryDialog } from "@/components/app/add-beneficiary-dialog";
import { BeneficiaryRow } from "@/components/app/beneficiary-row";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const beneficiaries = await getBeneficiariesForUser(user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Beneficiaries</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            Manage the people and businesses you send money to.
          </p>
        </div>
        <AddBeneficiaryDialog />
      </div>

      {beneficiaries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No payees yet"
          description="Add a payee's bank details to start sending them money by nickname."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {beneficiaries.map((b) => (
            <BeneficiaryRow
              key={b.id}
              id={b.id}
              nickname={b.nickname}
              bankName={b.bankName}
              accountNumber={b.accountNumber}
              ifsc={b.ifsc}
              status={b.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

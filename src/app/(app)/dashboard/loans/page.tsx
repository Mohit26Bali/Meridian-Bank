import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ChevronRight } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser, getLoansForUser } from "@/lib/banking/queries";
import { formatCurrency, formatDate } from "@/lib/banking/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { ApplyLoanDialog } from "@/components/app/apply-loan-dialog";
import { EmiCalculator } from "@/components/app/emi-calculator";

export const metadata: Metadata = { title: "Loans" };

const LOAN_TYPE_LABEL: Record<string, string> = {
  PERSONAL: "Personal",
  HOME: "Home",
  AUTO: "Auto",
  EDUCATION: "Education",
  BUSINESS: "Business",
};

const STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  APPLIED: "outline",
  UNDER_REVIEW: "outline",
  APPROVED: "secondary",
  DISBURSED: "secondary",
  CLOSED: "secondary",
  REJECTED: "destructive",
  DEFAULTED: "destructive",
};

export default async function LoansPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [accounts, loans] = await Promise.all([
    getAccountsForUser(user.id),
    getLoansForUser(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loans</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            Apply, track status, and manage repayments.
          </p>
        </div>
        <ApplyLoanDialog
          accounts={accounts.map((a) => ({
            id: a.id,
            accountType: a.accountType,
            accountNumber: a.accountNumber,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>EMI calculator</CardTitle>
          <CardDescription>Estimate your monthly payment before applying.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmiCalculator />
        </CardContent>
      </Card>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Apply for a personal, auto, home, education, or business loan above."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {loans.map((loan) => (
            <Link key={loan.id} href={`/dashboard/loans/${loan.id}`}>
              <Card className="hover:shadow-md hover:shadow-black/5 transition-shadow">
                <CardContent className="flex items-center justify-between gap-4 py-2">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                      <Landmark className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {LOAN_TYPE_LABEL[loan.type] ?? loan.type} loan
                      </p>
                      <p className="text-foreground-muted text-xs">
                        {formatCurrency(loan.principal.toString())} &middot; Applied{" "}
                        {formatDate(loan.appliedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[loan.status] ?? "outline"}>
                      {loan.status.replace("_", " ")}
                    </Badge>
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

import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getLoanForUser } from "@/lib/banking/queries";
import { generateRepaymentSchedule } from "@/lib/banking/loans";
import { formatCurrency, formatDate } from "@/lib/banking/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayEmiButton } from "@/components/app/pay-emi-button";

export const metadata: Metadata = { title: "Loan details" };

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

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ loanId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { loanId } = await params;
  const loan = await getLoanForUser(user.id, loanId);
  if (!loan) notFound();

  const schedule = generateRepaymentSchedule({
    principal: Number(loan.principal),
    interestRateApr: Number(loan.interestRateApr),
    termMonths: loan.termMonths,
    emiAmount: Number(loan.emiAmount),
    disbursedAt: loan.disbursedAt,
    paidInstallments: loan.paidInstallments,
  });

  const canPay = loan.status === "DISBURSED" && loan.paidInstallments < loan.termMonths;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/loans"
        className="text-foreground-secondary hover:text-foreground flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-3.5" />
        All loans
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-6 py-2">
          <div>
            <p className="text-foreground-secondary text-sm">
              {LOAN_TYPE_LABEL[loan.type] ?? loan.type} loan
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
              {formatCurrency(loan.principal.toString())}
            </p>
            <Badge variant={STATUS_VARIANT[loan.status] ?? "outline"} className="mt-3">
              {loan.status.replace("_", " ")}
            </Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-foreground-muted">Interest rate</dt>
            <dd>{loan.interestRateApr.toString()}% APR</dd>
            <dt className="text-foreground-muted">Term</dt>
            <dd>{loan.termMonths} months</dd>
            <dt className="text-foreground-muted">EMI</dt>
            <dd>{formatCurrency(loan.emiAmount.toString())}</dd>
            <dt className="text-foreground-muted">Installments paid</dt>
            <dd>
              {loan.paidInstallments} / {loan.termMonths}
            </dd>
            {loan.disbursedAt && (
              <>
                <dt className="text-foreground-muted">Disbursed</dt>
                <dd>{formatDate(loan.disbursedAt)}</dd>
              </>
            )}
          </dl>

          {canPay && <PayEmiButton loanId={loan.id} />}
        </CardContent>
      </Card>

      {schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Repayment schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">EMI</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((row) => (
                    <TableRow key={row.number}>
                      <TableCell>{row.number}</TableCell>
                      <TableCell>{formatDate(row.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.principalPortion)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.interestPortion)}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(row.emi)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.remainingBalance)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.paid ? "secondary" : "outline"}>
                          {row.paid ? "Paid" : "Upcoming"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

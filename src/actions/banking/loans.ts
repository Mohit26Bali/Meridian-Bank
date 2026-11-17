"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { generateReferenceNumber } from "@/lib/banking/identifiers";
import { LOAN_TERMS, calculateEmi } from "@/lib/banking/loans";
import { formatCurrency } from "@/lib/banking/format";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { notifyUser } from "@/lib/notifications";
import {
  loanApplicationSchema,
  payEmiSchema,
  type LoanApplicationInput,
  type PayEmiInput,
} from "@/lib/validations/loans";

export type ApplyLoanResult =
  | { success: true; approved: true; loanId: string; emiAmount: number }
  | { success: true; approved: false; reason: string }
  | { success: false; error: string };

export async function applyForLoanAction(
  input: LoanApplicationInput
): Promise<ApplyLoanResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = loanApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Check the loan application details." };
  }

  const { success: withinLimit } = checkRateLimit(
    `loan-apply:${user.id}`,
    RATE_LIMITS.LOAN_APPLY.limit,
    RATE_LIMITS.LOAN_APPLY.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many applications recently. Try again later." };
  }

  const { accountId, type, principal, termMonths } = parsed.data;
  const terms = LOAN_TERMS[type];

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return { success: false, error: "Account not found." };
  if (account.status !== "ACTIVE") {
    return { success: false, error: "This account can't receive a disbursement right now." };
  }

  const { ipAddress, userAgent } = await getRequestContext();

  const loan = await prisma.loan.create({
    data: {
      userId: user.id,
      accountId,
      type,
      principal,
      termMonths,
      interestRateApr: terms.aprPercent,
      emiAmount: 0,
      status: "APPLIED",
    },
  });

  // Mock instant underwriting: reject only if outside the product's bounds.
  const outOfBounds =
    principal < terms.minPrincipal ||
    principal > terms.maxPrincipal ||
    termMonths < terms.minTermMonths ||
    termMonths > terms.maxTermMonths;

  if (outOfBounds) {
    await prisma.loan.update({ where: { id: loan.id }, data: { status: "REJECTED" } });
    await writeAuditLog({
      userId: user.id,
      action: "LOAN_REJECTED",
      entityType: "Loan",
      entityId: loan.id,
      ipAddress,
      userAgent,
    });
    return {
      success: true,
      approved: false,
      reason: `This loan type allows ${formatCurrency(terms.minPrincipal)}–${formatCurrency(terms.maxPrincipal)} over ${terms.minTermMonths}–${terms.maxTermMonths} months.`,
    };
  }

  const emiAmount = calculateEmi(principal, terms.aprPercent, termMonths);
  const now = new Date();
  const referenceNumber = generateReferenceNumber("DEPOSIT");

  await prisma.$transaction([
    prisma.loan.update({
      where: { id: loan.id },
      data: {
        status: "DISBURSED",
        emiAmount,
        approvedAt: now,
        disbursedAt: now,
      },
    }),
    prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: principal } },
    }),
    prisma.transaction.create({
      data: {
        referenceNumber,
        type: "DEPOSIT",
        status: "COMPLETED",
        receiverAccountId: accountId,
        amount: principal,
        currency: account.currency,
        description: `Loan disbursement — ${type.toLowerCase()} loan`,
      },
    }),
  ]);

  await writeAuditLog({
    userId: user.id,
    action: "LOAN_DISBURSED",
    entityType: "Loan",
    entityId: loan.id,
    ipAddress,
    userAgent,
    metadata: { principal, termMonths, type },
  });

  await notifyUser({
    userId: user.id,
    category: "TRANSACTION",
    title: "Loan approved and disbursed",
    body: `Your ${type.toLowerCase()} loan for ${formatCurrency(principal)} was approved and disbursed.`,
  });

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");

  return { success: true, approved: true, loanId: loan.id, emiAmount };
}

export type PayEmiResult = { success: true } | { success: false; error: string };

export async function payEmiAction(input: PayEmiInput): Promise<PayEmiResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = payEmiSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Loan not found." };

  const loan = await prisma.loan.findFirst({
    where: { id: parsed.data.loanId, userId: user.id },
  });
  if (!loan) return { success: false, error: "Loan not found." };
  if (loan.status !== "DISBURSED" || !loan.accountId) {
    return { success: false, error: "This loan has no payment due." };
  }
  if (loan.paidInstallments >= loan.termMonths) {
    return { success: false, error: "This loan is already fully repaid." };
  }

  const account = await prisma.account.findFirst({
    where: { id: loan.accountId, userId: user.id },
  });
  if (!account) return { success: false, error: "Repayment account not found." };
  if (Number(account.balance) < Number(loan.emiAmount)) {
    return { success: false, error: "Insufficient balance to cover this EMI." };
  }

  const nextInstallment = loan.paidInstallments + 1;
  const isFinalInstallment = nextInstallment >= loan.termMonths;
  const referenceNumber = generateReferenceNumber("CHARGE");
  const { ipAddress, userAgent } = await getRequestContext();

  try {
    await prisma.$transaction(async (tx) => {
      // Claim this instalment FIRST: the update only matches if nobody else has paid it since we
      // read the loan. Parallel requests used to each debit the account while only one instalment
      // was recorded. If the debit below fails, the whole transaction (including this claim) rolls back.
      const claimed = await tx.loan.updateMany({
        where: {
          id: loan.id,
          userId: user.id,
          status: "DISBURSED",
          paidInstallments: loan.paidInstallments,
        },
        data: {
          paidInstallments: nextInstallment,
          status: isFinalInstallment ? "CLOSED" : undefined,
          closedAt: isFinalInstallment ? new Date() : undefined,
        },
      });
      if (claimed.count === 0) throw new Error("ALREADY_PAID");

      const debited = await tx.account.updateMany({
        where: { id: account.id, balance: { gte: loan.emiAmount } },
        data: { balance: { decrement: loan.emiAmount } },
      });
      if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const updatedAccount = await tx.account.findUniqueOrThrow({ where: { id: account.id } });

      await tx.transaction.create({
        data: {
          referenceNumber,
          type: "CHARGE",
          status: "COMPLETED",
          senderAccountId: account.id,
          amount: loan.emiAmount,
          balanceAfter: updatedAccount.balance,
          currency: account.currency,
          description: `EMI payment ${nextInstallment}/${loan.termMonths} — ${loan.type.toLowerCase()} loan`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_PAID") {
      return { success: false, error: "This instalment was already paid. Refresh to see the latest status." };
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { success: false, error: "Insufficient balance to cover this EMI." };
    }
    throw error;
  }

  await writeAuditLog({
    userId: user.id,
    action: "LOAN_EMI_PAID",
    entityType: "Loan",
    entityId: loan.id,
    ipAddress,
    userAgent,
    metadata: { installment: nextInstallment },
  });

  await notifyUser({
    userId: user.id,
    category: "TRANSACTION",
    title: isFinalInstallment ? "Loan paid off" : "EMI payment made",
    body: isFinalInstallment
      ? `Installment ${nextInstallment}/${loan.termMonths} paid — your loan is now fully repaid.`
      : `Installment ${nextInstallment}/${loan.termMonths} of ${formatCurrency(loan.emiAmount.toString())} was paid.`,
  });

  revalidatePath("/dashboard/loans");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");

  return { success: true };
}

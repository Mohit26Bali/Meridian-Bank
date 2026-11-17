"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { generateReferenceNumber } from "@/lib/banking/identifiers";
import {
  INVESTMENT_TERMS,
  computeCurrentValue,
  maturityDateFor,
} from "@/lib/banking/investments";
import { notifyUser } from "@/lib/notifications";
import { formatCurrency } from "@/lib/banking/format";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  createInvestmentSchema,
  withdrawInvestmentSchema,
  type CreateInvestmentInput,
  type WithdrawInvestmentInput,
} from "@/lib/validations/investments";

export type InvestmentActionResult = { success: true } | { success: false; error: string };

export async function createInvestmentAction(
  input: CreateInvestmentInput
): Promise<InvestmentActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = createInvestmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Check the investment details." };
  }

  const { success: withinLimit } = checkRateLimit(
    `investment-create:${user.id}`,
    RATE_LIMITS.INVESTMENT_CREATE.limit,
    RATE_LIMITS.INVESTMENT_CREATE.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many investments created recently." };
  }

  const { accountId, type, principal } = parsed.data;

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
  if (!account) return { success: false, error: "Account not found." };
  if (account.status !== "ACTIVE") {
    return { success: false, error: "This account can't fund investments right now." };
  }
  if (Number(account.balance) < principal) {
    return { success: false, error: "Insufficient balance to fund this investment." };
  }

  const terms = INVESTMENT_TERMS[type];
  const startDate = new Date();
  const maturityDate = maturityDateFor(type, startDate);
  const referenceNumber = generateReferenceNumber("WITHDRAWAL");
  const { ipAddress, userAgent } = await getRequestContext();

  await prisma.$transaction(async (tx) => {
    const debited = await tx.account.updateMany({
      where: { id: account.id, balance: { gte: principal } },
      data: { balance: { decrement: principal } },
    });
    if (debited.count === 0) throw new Error("INSUFFICIENT_BALANCE");

    const updatedAccount = await tx.account.findUniqueOrThrow({ where: { id: account.id } });

    await tx.transaction.create({
      data: {
        referenceNumber,
        type: "WITHDRAWAL",
        status: "COMPLETED",
        senderAccountId: account.id,
        amount: principal,
        balanceAfter: updatedAccount.balance,
        currency: account.currency,
        description: `Invested in ${type.toLowerCase().replace("_", " ")}`,
      },
    });

    await tx.investment.create({
      data: {
        userId: user.id,
        accountId: account.id,
        type,
        principal,
        currentValue: principal,
        expectedReturnRate: terms.expectedReturnRate,
        startDate,
        maturityDate,
      },
    });
  });

  await writeAuditLog({
    userId: user.id,
    action: "INVESTMENT_CREATED",
    entityType: "Investment",
    entityId: account.id,
    ipAddress,
    userAgent,
    metadata: { type, principal },
  });

  await notifyUser({
    userId: user.id,
    category: "TRANSACTION",
    title: "Investment started",
    body: `${formatCurrency(principal)} invested in ${type.toLowerCase().replace("_", " ")}.`,
  });

  revalidatePath("/dashboard/investments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");

  return { success: true };
}

export async function withdrawInvestmentAction(
  input: WithdrawInvestmentInput
): Promise<InvestmentActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = withdrawInvestmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Investment not found." };

  const investment = await prisma.investment.findFirst({
    where: { id: parsed.data.investmentId, userId: user.id },
  });
  if (!investment) return { success: false, error: "Investment not found." };
  if (investment.status !== "ACTIVE") {
    return { success: false, error: "This investment has already been closed out." };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
  });
  if (!account) return { success: false, error: "Payout account not found." };
  if (account.status !== "ACTIVE") {
    return { success: false, error: "This account can't receive a payout right now." };
  }

  const terms = INVESTMENT_TERMS[investment.type];
  const currentValue = computeCurrentValue({
    id: investment.id,
    type: investment.type,
    principal: Number(investment.principal),
    expectedReturnRate: Number(investment.expectedReturnRate),
    startDate: investment.startDate,
    maturityDate: investment.maturityDate,
  });

  const isEarlyWithdrawal = Boolean(
    investment.maturityDate && new Date() < investment.maturityDate
  );
  const penaltyPercent = isEarlyWithdrawal ? terms.earlyWithdrawalPenaltyPercent : 0;
  const payout = Math.round(currentValue * (1 - penaltyPercent / 100) * 100) / 100;

  const referenceNumber = generateReferenceNumber("REFUND");
  const { ipAddress, userAgent } = await getRequestContext();

  try {
    await prisma.$transaction(async (tx) => {
      // Claim the investment FIRST with a conditional update. Previously the status was only read
      // above and then written, so parallel requests each passed the check and each got paid.
      const claimed = await tx.investment.updateMany({
        where: { id: investment.id, userId: user.id, status: "ACTIVE" },
        data: { status: "WITHDRAWN", currentValue },
      });
      if (claimed.count === 0) throw new Error("ALREADY_CLOSED");

      const updatedAccount = await tx.account.update({
        where: { id: account.id },
        data: { balance: { increment: payout } },
      });

      await tx.transaction.create({
        data: {
          referenceNumber,
          type: "REFUND",
          status: "COMPLETED",
          receiverAccountId: account.id,
          amount: payout,
          balanceAfter: updatedAccount.balance,
          currency: account.currency,
          description: isEarlyWithdrawal
            ? `${investment.type.toLowerCase().replace("_", " ")} withdrawn early (${penaltyPercent}% penalty applied)`
            : `${investment.type.toLowerCase().replace("_", " ")} withdrawn`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CLOSED") {
      return { success: false, error: "This investment has already been closed out." };
    }
    throw error;
  }

  await writeAuditLog({
    userId: user.id,
    action: "INVESTMENT_WITHDRAWN",
    entityType: "Investment",
    entityId: investment.id,
    ipAddress,
    userAgent,
    metadata: { payout, penaltyPercent },
  });

  await notifyUser({
    userId: user.id,
    category: "TRANSACTION",
    title: "Investment withdrawn",
    body: `${formatCurrency(payout)} paid out from your ${investment.type.toLowerCase().replace("_", " ")}.`,
  });

  revalidatePath("/dashboard/investments");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");

  return {
    success: true,
  };
}

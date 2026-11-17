"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { generateReferenceNumber } from "@/lib/banking/identifiers";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { depositSchema, type DepositInput } from "@/lib/validations/banking";
import { notifyUser } from "@/lib/notifications";
import { formatCurrency } from "@/lib/banking/format";

export type DepositResult =
  | { success: true; referenceNumber: string }
  | { success: false; error: string };

/**
 * Simulated deposit — stands in for an external funding source (ACH pull,
 * wire, mobile check deposit) since this platform doesn't move real money.
 */
export async function depositAction(input: DepositInput): Promise<DepositResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Please log in again." };
  }

  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid amount.",
    };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `mock-deposit:${user.id}`,
    RATE_LIMITS.MOCK_DEPOSIT.limit,
    RATE_LIMITS.MOCK_DEPOSIT.windowMs
  );
  if (!withinLimit) {
    return {
      success: false,
      error: "You've reached the mock deposit limit for this hour.",
    };
  }

  const account = await prisma.account.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
  });

  if (!account) {
    return { success: false, error: "That account could not be found." };
  }

  if (account.status !== "ACTIVE") {
    return { success: false, error: "This account cannot accept deposits right now." };
  }

  const referenceNumber = generateReferenceNumber("DEPOSIT");

  // Increment atomically in the database. (Reading the balance in JS and writing back
  // `old + amount` lost updates when two requests overlapped, e.g. a deposit during a transfer.)
  await prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id: account.id },
      data: { balance: { increment: parsed.data.amount } },
    });

    await tx.transaction.create({
      data: {
        referenceNumber,
        type: "DEPOSIT",
        status: "COMPLETED",
        receiverAccountId: account.id,
        amount: parsed.data.amount,
        balanceAfter: updated.balance,
        currency: account.currency,
        description: parsed.data.description || "Mock deposit",
      },
    });
  });

  await writeAuditLog({
    userId: user.id,
    action: "MOCK_DEPOSIT",
    entityType: "Account",
    entityId: account.id,
    ipAddress,
    userAgent,
    metadata: { amount: parsed.data.amount, referenceNumber },
  });

  await notifyUser({
    userId: user.id,
    category: "TRANSACTION",
    title: "Deposit received",
    body: `${formatCurrency(parsed.data.amount, account.currency)} was deposited into your account.`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounts");
  revalidatePath("/dashboard/transactions");

  return { success: true, referenceNumber };
}

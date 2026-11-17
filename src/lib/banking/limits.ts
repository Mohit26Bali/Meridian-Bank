import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

/** Hard cap per transaction, independent of the account's rolling daily limit. */
export const MAX_SINGLE_TRANSFER_AMOUNT = 5_000;

/** Two transfers are treated as possible duplicates within this window. */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/** `client` lets callers run the check inside an open `prisma.$transaction`. */
export async function getSentTodayTotal(
  accountId: string,
  client: Pick<Prisma.TransactionClient, "transaction"> = prisma
) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await client.transaction.aggregate({
    where: {
      senderAccountId: accountId,
      type: "TRANSFER",
      status: { in: ["COMPLETED", "PENDING", "PROCESSING"] },
      createdAt: { gte: startOfDay },
    },
    _sum: { amount: true },
  });

  return Number(result._sum.amount ?? 0);
}

export async function findLikelyDuplicate(params: {
  senderAccountId: string;
  amount: number;
  receiverAccountId?: string;
  receiverBeneficiaryId?: string;
}) {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  return prisma.transaction.findFirst({
    where: {
      senderAccountId: params.senderAccountId,
      amount: params.amount,
      type: "TRANSFER",
      status: { in: ["COMPLETED", "PENDING", "PROCESSING"] },
      createdAt: { gte: since },
      ...(params.receiverAccountId
        ? { receiverAccountId: params.receiverAccountId }
        : {}),
      ...(params.receiverBeneficiaryId
        ? { receiverBeneficiaryId: params.receiverBeneficiaryId }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

import "server-only";
import type { TransactionType, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getAccountsForUser(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAccountForUser(userId: string, accountId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, userId },
  });
}

export async function getBeneficiariesForUser(userId: string) {
  return prisma.beneficiary.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
}

export async function getVerifiedBeneficiaryForUser(userId: string, beneficiaryId: string) {
  return prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, userId, status: "VERIFIED" },
  });
}

export async function getCardsForUser(userId: string) {
  return prisma.card.findMany({
    where: { userId, status: { not: "REPLACED" } },
    include: { account: { select: { accountType: true, accountNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getLoansForUser(userId: string) {
  return prisma.loan.findMany({
    where: { userId },
    orderBy: { appliedAt: "desc" },
  });
}

export async function getLoanForUser(userId: string, loanId: string) {
  return prisma.loan.findFirst({ where: { id: loanId, userId } });
}

export async function getInvestmentsForUser(userId: string) {
  return prisma.investment.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
  });
}

export async function getInvestmentForUser(userId: string, investmentId: string) {
  return prisma.investment.findFirst({ where: { id: investmentId, userId } });
}

export async function getRecentTransactionsForUser(userId: string, limit = 5) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  return prisma.transaction.findMany({
    where: {
      OR: [
        { senderAccountId: { in: accountIds } },
        { receiverAccountId: { in: accountIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      senderAccount: { select: { accountNumber: true, accountType: true } },
      receiverAccount: { select: { accountNumber: true, accountType: true } },
    },
  });
}

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  search?: string;
  from?: Date;
  to?: Date;
}

export async function getTransactionsForUser(
  userId: string,
  filters: TransactionFilters,
  page: number,
  pageSize: number
) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const accountIds = filters.accountId
    ? accounts.filter((a) => a.id === filters.accountId).map((a) => a.id)
    : accounts.map((a) => a.id);

  if (accountIds.length === 0) {
    return { transactions: [], total: 0 };
  }

  const where = {
    OR: [
      { senderAccountId: { in: accountIds } },
      { receiverAccountId: { in: accountIds } },
    ],
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { referenceNumber: { contains: filters.search, mode: "insensitive" as const } },
            { description: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        senderAccount: { select: { accountNumber: true, accountType: true } },
        receiverAccount: { select: { accountNumber: true, accountType: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total };
}

export async function getMonthlyActivityForUser(userId: string, months = 6) {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { senderAccountId: { in: accountIds } },
        { receiverAccountId: { in: accountIds } },
      ],
      status: "COMPLETED",
      createdAt: { gte: since },
    },
    select: {
      amount: true,
      createdAt: true,
      senderAccountId: true,
      receiverAccountId: true,
    },
  });

  const buckets = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    const key = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;

    const isIncoming = tx.receiverAccountId && accountIds.includes(tx.receiverAccountId);
    const isOutgoing = tx.senderAccountId && accountIds.includes(tx.senderAccountId);

    if (isIncoming) bucket.income += Number(tx.amount);
    if (isOutgoing) bucket.expense += Number(tx.amount);
  }

  return Array.from(buckets.entries()).map(([key, value]) => {
    const [year, month] = key.split("-").map(Number);
    const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "short",
    });
    return { month: label, ...value };
  });
}

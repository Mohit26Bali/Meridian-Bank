import "server-only";
import type { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function getAdminOverviewStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    activeUsers,
    pendingKycCount,
    balanceAgg,
    transactionsToday,
    recentAuditLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.kyc.count({ where: { status: "PENDING" } }),
    prisma.account.aggregate({ _sum: { balance: true } }),
    prisma.transaction.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);

  return {
    totalUsers,
    activeUsers,
    pendingKycCount,
    totalBalance: balanceAgg._sum.balance?.toString() ?? "0",
    transactionsToday,
    recentAuditLogs,
  };
}

export interface UserListFilters {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
}

export async function getUsers(filters: UserListFilters, page: number, pageSize: number) {
  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { phone: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { kyc: { select: { status: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

export async function getUserDetail(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      cards: true,
      loans: true,
      investments: true,
      kyc: { include: { documents: true } },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        include: { device: true },
        orderBy: { updatedAt: "desc" },
      },
      loginHistory: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });
}

export async function getPendingKycQueue(page: number, pageSize: number) {
  const where: Prisma.KycWhereInput = { status: "PENDING" };

  const [items, total] = await Promise.all([
    prisma.kyc.findMany({
      where,
      orderBy: { submittedAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        documents: true,
      },
    }),
    prisma.kyc.count({ where }),
  ]);

  return { items, total };
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  search?: string;
}

export async function getAuditLogs(filters: AuditLogFilters, page: number, pageSize: number) {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.search
      ? {
          user: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [logs, total, distinctActions, distinctEntityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  return {
    logs,
    total,
    distinctActions: distinctActions.map((a) => a.action),
    distinctEntityTypes: distinctEntityTypes.map((e) => e.entityType),
  };
}

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

interface AuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, Prisma.InputJsonValue>;
}

export async function writeAuditLog(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    },
  });
}

export async function recordLoginAttempt(input: {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  successful: boolean;
  reason?: string;
}) {
  await prisma.loginHistory.create({
    data: {
      userId: input.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      successful: input.successful,
      reason: input.reason,
    },
  });
}

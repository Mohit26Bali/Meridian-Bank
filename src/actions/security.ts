"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getCurrentSessionId } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";

export type SecurityActionResult = { success: true } | { success: false; error: string };

export async function getLoginHistoryForUser(userId: string) {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function revokeSessionAction(sessionId: string): Promise<SecurityActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  if (!session) return { success: false, error: "Session not found." };

  const currentSessionId = await getCurrentSessionId();
  if (session.id === currentSessionId) {
    return { success: false, error: "You can't revoke your current session here. Log out instead." };
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "SESSION_REVOKED",
    entityType: "Session",
    entityId: session.id,
    ipAddress,
    userAgent,
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

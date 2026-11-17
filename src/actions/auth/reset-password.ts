"use server";

import { prisma } from "@/lib/db/prisma";
import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { revokeCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { notifyUser } from "@/lib/notifications";

export type ResetPasswordResult = { success: true } | { success: false; error: string };

export async function resetPasswordAction(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors.password?.[0]
      ?? parsed.error.flatten().fieldErrors.confirmPassword?.[0]
      ?? "Please check the highlighted fields.";
    return { success: false, error: message };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const tokenHash = hashToken(parsed.data.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return {
      success: false,
      error: "This reset link is invalid or has expired. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Revoke every active session so a stolen credential can't stay logged in.
    prisma.session.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await revokeCurrentSession();

  await writeAuditLog({
    userId: resetToken.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: resetToken.userId,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: resetToken.userId,
    category: "SECURITY",
    title: "Password changed",
    body: "Your password was reset and all other sessions were signed out.",
  });

  return { success: true };
}

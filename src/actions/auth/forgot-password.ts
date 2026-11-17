"use server";

import { prisma } from "@/lib/db/prisma";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";
import { runAfterResponse } from "@/lib/after-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getRequestContext } from "@/lib/security/request-context";
import { writeAuditLog } from "@/lib/security/audit";
import { forgotPasswordSchema } from "@/lib/validations/auth";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export type ForgotPasswordResult = { success: true } | { success: false; error: string };

// Always returns success to callers regardless of whether the email exists,
// to avoid leaking account existence to an unauthenticated caller.
export async function forgotPasswordAction(input: {
  email: string;
}): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email address." };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `password-reset-request:${ipAddress ?? "unknown"}`,
    RATE_LIMITS.PASSWORD_RESET_REQUEST.limit,
    RATE_LIMITS.PASSWORD_RESET_REQUEST.windowMs
  );
  if (!withinLimit) {
    return { success: true };
  }

  // Also limit per target address, so one attacker cannot bury a victim's inbox with reset mails
  // (and so a missing/shared client IP does not turn the per-IP limit into a global one).
  const { success: withinEmailLimit } = checkRateLimit(
    `password-reset-email:${parsed.data.email}`,
    RATE_LIMITS.PASSWORD_RESET_REQUEST.limit,
    RATE_LIMITS.PASSWORD_RESET_REQUEST.windowMs
  );
  if (!withinEmailLimit) {
    return { success: true };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (user) {
    const { raw, hash } = generateOpaqueToken();

    // Only the newest link works: retire any earlier unused tokens for this user.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        ipAddress,
      },
    });

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
    const message = passwordResetEmail({
      firstName: user.firstName,
      resetUrl: `${baseUrl}/reset-password?token=${encodeURIComponent(raw)}`,
      expiresInMinutes: RESET_TOKEN_TTL_MS / 60_000,
    });
    await runAfterResponse(async () => {
      await sendEmail({ to: user.email, ...message });
    });

    // Development convenience only — the token is never logged in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(`[mock-email] password reset token for ${user.email}: ${raw}`);
    }

    await writeAuditLog({
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
    });
  }

  return { success: true };
}

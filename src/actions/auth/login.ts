"use server";

import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { setPendingVerificationCookie } from "@/lib/auth/pending-verification";
import { setPending2faCookie } from "@/lib/auth/pending-2fa";
import { issueOtp } from "@/lib/auth/otp";
import { recordLoginAttempt, writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { notifyUser } from "@/lib/notifications";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export type LoginResult =
  | { success: true; requiresVerification?: false; requires2FA?: false }
  | { success: true; requiresVerification: true; requires2FA?: false }
  | { success: true; requiresVerification?: false; requires2FA: true }
  | { success: false; error: string };

export async function loginAction(input: LoginInput): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter a valid email and password." };
  }

  const { email, password, rememberMe } = parsed.data;
  const { ipAddress, userAgent } = await getRequestContext();

  const { success: withinLimit } = checkRateLimit(
    `login:${ipAddress ?? "unknown"}:${email}`,
    RATE_LIMITS.LOGIN.limit,
    RATE_LIMITS.LOGIN.windowMs
  );
  if (!withinLimit) {
    return {
      success: false,
      error: "Too many login attempts. Please try again in a few minutes.",
    };
  }

  const genericError = "Incorrect email or password.";
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return { success: false, error: genericError };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      success: false,
      error: "Your account is temporarily locked due to repeated failed attempts.",
    };
  }

  if (user.status === "SUSPENDED" || user.status === "CLOSED") {
    return { success: false, error: "This account is no longer active." };
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);

  if (!passwordValid) {
    const failedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_DURATION_MS)
          : undefined,
      },
    });

    await recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      successful: false,
      reason: shouldLock ? "locked_out" : "incorrect_password",
    });

    return {
      success: false,
      error: shouldLock
        ? "Too many failed attempts. Your account has been locked for 15 minutes."
        : genericError,
    };
  }

  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  if (!user.emailVerified || user.status === "PENDING_VERIFICATION") {
    await issueOtp(user.id, "SIGNUP_VERIFICATION");
    await setPendingVerificationCookie(user.id);
    await recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      successful: false,
      reason: "email_not_verified",
    });
    return { success: true, requiresVerification: true };
  }

  if (user.twoFactorEnabled) {
    await setPending2faCookie(user.id, rememberMe);
    await recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      successful: false,
      reason: "awaiting_2fa",
    });
    return { success: true, requires2FA: true };
  }

  await createSession(user, { ipAddress, userAgent }, rememberMe);

  await recordLoginAttempt({
    userId: user.id,
    ipAddress,
    userAgent,
    successful: true,
  });

  await writeAuditLog({
    userId: user.id,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "New sign-in",
    body: `A new sign-in was detected${ipAddress ? ` from ${ipAddress}` : ""}. If this wasn't you, reset your password immediately.`,
  });

  return { success: true };
}

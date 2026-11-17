"use server";

import { prisma } from "@/lib/db/prisma";
import { verifyOtp, issueOtp } from "@/lib/auth/otp";
import {
  getPendingVerificationUserId,
  clearPendingVerificationCookie,
} from "@/lib/auth/pending-verification";
import { createSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { otpSchema } from "@/lib/validations/auth";
import { provisionDefaultAccounts } from "@/lib/banking/provision-accounts";
import { notifyUser } from "@/lib/notifications";

export type VerifyEmailResult =
  | { success: true }
  | { success: false; error: string };

export async function verifyEmailAction(
  input: { code: string }
): Promise<VerifyEmailResult> {
  const parsed = otpSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Enter the 6-digit code." };
  }

  const userId = await getPendingVerificationUserId();
  if (!userId) {
    return {
      success: false,
      error: "Your verification session expired. Please sign up again.",
    };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `otp-verify:${userId}`,
    RATE_LIMITS.OTP_VERIFY.limit,
    RATE_LIMITS.OTP_VERIFY.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const result = await verifyOtp(userId, "SIGNUP_VERIFICATION", parsed.data.code);
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "No pending verification found. Request a new code.",
      expired: "This code has expired. Request a new one.",
      too_many_attempts: "Too many incorrect attempts. Request a new code.",
      incorrect: "That code is incorrect.",
    };
    return { success: false, error: messages[result.reason] };
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, status: "ACTIVE" },
  });

  await provisionDefaultAccounts(user.id);

  await clearPendingVerificationCookie();
  await createSession(user, { ipAddress, userAgent });

  await writeAuditLog({
    userId: user.id,
    action: "EMAIL_VERIFIED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SYSTEM",
    title: "Welcome to Meridian Bank",
    body: "Your email is verified and your Checking and Savings accounts are ready to use.",
  });

  return { success: true };
}

export async function resendVerificationOtpAction(): Promise<VerifyEmailResult> {
  const userId = await getPendingVerificationUserId();
  if (!userId) {
    return {
      success: false,
      error: "Your verification session expired. Please sign up again.",
    };
  }

  const { success: withinLimit } = checkRateLimit(
    `otp-request:${userId}`,
    RATE_LIMITS.OTP_REQUEST.limit,
    RATE_LIMITS.OTP_REQUEST.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Please wait before requesting another code." };
  }

  await issueOtp(userId, "SIGNUP_VERIFICATION");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, createSession } from "@/lib/auth/session";
import {
  generateTotpSecret,
  buildTotpUri,
  generateTotpQrCodeDataUrl,
  verifyTotpToken,
} from "@/lib/auth/totp";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import { verifyPassword } from "@/lib/auth/password";
import {
  getPending2fa,
  clearPending2faCookie,
} from "@/lib/auth/pending-2fa";
import { recordLoginAttempt, writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { notifyUser } from "@/lib/notifications";
import { totpTokenSchema, type TotpTokenInput } from "@/lib/validations/two-factor";

export type TwoFactorActionResult = { success: true } | { success: false; error: string };

export type SetupTwoFactorResult =
  | { success: true; qrCodeDataUrl: string; secret: string }
  | { success: false; error: string };

export async function setupTwoFactorAction(): Promise<SetupTwoFactorResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };
  if (user.twoFactorEnabled) {
    return { success: false, error: "Two-factor authentication is already enabled." };
  }

  const secret = generateTotpSecret();
  const uri = buildTotpUri(secret, user.email);
  const qrCodeDataUrl = await generateTotpQrCodeDataUrl(uri);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: encryptSecret(secret) },
  });

  return { success: true, qrCodeDataUrl, secret };
}

export async function verifyTwoFactorSetupAction(
  input: TotpTokenInput
): Promise<TwoFactorActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = totpTokenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Enter the 6-digit code." };

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!fullUser.twoFactorSecret) {
    return { success: false, error: "Start setup again." };
  }

  const { success: withinLimit } = checkRateLimit(
    `2fa-verify:${user.id}`,
    RATE_LIMITS.TWO_FACTOR_VERIFY.limit,
    RATE_LIMITS.TWO_FACTOR_VERIFY.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const secret = decryptSecret(fullUser.twoFactorSecret);
  if (!verifyTotpToken(secret, parsed.data.token)) {
    return { success: false, error: "That code is incorrect." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "TWO_FACTOR_ENABLED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Two-factor authentication enabled",
    body: "Your account now requires a code from your authenticator app at sign-in.",
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export type ConfirmLogin2FAResult = { success: true } | { success: false; error: string };

export async function confirmLogin2FAAction(
  input: TotpTokenInput
): Promise<ConfirmLogin2FAResult> {
  const pending = await getPending2fa();
  if (!pending) {
    return { success: false, error: "Your session expired. Log in again." };
  }

  const parsed = totpTokenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Enter the 6-digit code." };

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `2fa-login-verify:${pending.userId}`,
    5,
    10 * 60 * 1000
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const user = await prisma.user.findUnique({ where: { id: pending.userId } });
  if (!user || !user.twoFactorSecret) {
    await clearPending2faCookie();
    return { success: false, error: "Your session expired. Log in again." };
  }

  const secret = decryptSecret(user.twoFactorSecret);
  if (!verifyTotpToken(secret, parsed.data.token)) {
    await recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      successful: false,
      reason: "incorrect_2fa_code",
    });
    return { success: false, error: "That code is incorrect." };
  }

  await createSession(user, { ipAddress, userAgent }, pending.rememberMe);
  await clearPending2faCookie();

  await recordLoginAttempt({ userId: user.id, ipAddress, userAgent, successful: true });
  await writeAuditLog({
    userId: user.id,
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
    metadata: { via: "2fa" },
  });
  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "New sign-in",
    body: `A new sign-in was detected${ipAddress ? ` from ${ipAddress}` : ""}. If this wasn't you, reset your password immediately.`,
  });

  return { success: true };
}

export async function disableTwoFactorAction(input: {
  password: string;
}): Promise<TwoFactorActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  if (!input.password) {
    return { success: false, error: "Enter your password to confirm." };
  }

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const valid = await verifyPassword(fullUser.passwordHash, input.password);
  if (!valid) {
    return { success: false, error: "Incorrect password." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "TWO_FACTOR_DISABLED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Two-factor authentication disabled",
    body: "Your account no longer requires an authenticator app code at sign-in.",
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

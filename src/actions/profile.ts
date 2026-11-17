"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { readAuthCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { notifyUser } from "@/lib/notifications";
import {
  updateProfileSchema,
  changePasswordSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
} from "@/lib/validations/profile";

export type ProfileActionResult = { success: true } | { success: false; error: string };

export async function updateProfileAction(
  input: UpdateProfileInput
): Promise<ProfileActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
    };
  }

  const { firstName, lastName, dateOfBirth, ...rest } = parsed.data;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      occupation: rest.occupation || null,
      addressLine1: rest.addressLine1 || null,
      addressLine2: rest.addressLine2 || null,
      city: rest.city || null,
      state: rest.state || null,
      postalCode: rest.postalCode || null,
      country: rest.country || null,
      nomineeName: rest.nomineeName || null,
      nomineeRelation: rest.nomineeRelation || null,
      emergencyContact: rest.emergencyContact || null,
    },
  });

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function changePasswordAction(
  input: ChangePasswordInput
): Promise<ProfileActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the password fields.",
    };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `password-change:${user.id}`,
    RATE_LIMITS.PASSWORD_CHANGE.limit,
    RATE_LIMITS.PASSWORD_CHANGE.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many attempts. Please try again later." };
  }

  const fullUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const currentValid = await verifyPassword(fullUser.passwordHash, parsed.data.currentPassword);
  if (!currentValid) {
    return { success: false, error: "Current password is incorrect." };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const { refreshToken } = await readAuthCookies();
  const currentSessionHash = refreshToken ? hashToken(refreshToken) : null;

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(currentSessionHash ? { refreshToken: { not: currentSessionHash } } : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAuditLog({
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Password changed",
    body: "Your password was updated. All other sessions were signed out.",
  });

  return { success: true };
}

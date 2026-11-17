"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { issueOtp } from "@/lib/auth/otp";
import { setPendingVerificationCookie } from "@/lib/auth/pending-verification";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";

export type SignupResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function signupAction(input: SignupInput): Promise<SignupResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const rateLimitKey = `signup:${ipAddress ?? "unknown"}`;
  const { success: withinLimit } = checkRateLimit(
    rateLimitKey,
    RATE_LIMITS.SIGNUP.limit,
    RATE_LIMITS.SIGNUP.windowMs
  );
  if (!withinLimit) {
    return {
      success: false,
      error: "Too many signup attempts. Please try again later.",
    };
  }

  const { firstName, lastName, email, phone, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        passwordHash,
        kyc: { create: {} },
      },
    });

    await issueOtp(user.id, "SIGNUP_VERIFICATION");
    await setPendingVerificationCookie(user.id);

    await writeAuditLog({
      userId: user.id,
      action: "USER_SIGNUP",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    return { success: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      const field = target.includes("email") ? "email" : "phone";
      return {
        success: false,
        error: "An account with these details already exists.",
        fieldErrors: { [field]: ["This value is already in use."] },
      };
    }

    return {
      success: false,
      error: "Something went wrong while creating your account. Please try again.",
    };
  }
}

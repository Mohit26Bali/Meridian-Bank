"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validations/banking";
import { notifyUser } from "@/lib/notifications";

export type BeneficiaryActionResult =
  | { success: true }
  | { success: false; error: string };

export async function addBeneficiaryAction(
  input: BeneficiaryInput
): Promise<BeneficiaryActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = beneficiarySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the payee details.",
    };
  }

  const { ipAddress, userAgent } = await getRequestContext();
  const { success: withinLimit } = checkRateLimit(
    `beneficiary-add:${user.id}`,
    RATE_LIMITS.BENEFICIARY_ADD.limit,
    RATE_LIMITS.BENEFICIARY_ADD.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many payees added recently. Try again later." };
  }

  const existing = await prisma.beneficiary.findFirst({
    where: {
      userId: user.id,
      accountNumber: parsed.data.accountNumber,
      ifsc: parsed.data.ifsc,
    },
  });
  if (existing) {
    return { success: false, error: "You've already added this payee." };
  }

  const beneficiary = await prisma.beneficiary.create({
    data: { userId: user.id, ...parsed.data },
  });

  await writeAuditLog({
    userId: user.id,
    action: "BENEFICIARY_ADDED",
    entityType: "Beneficiary",
    entityId: beneficiary.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SECURITY",
    title: "Payee added",
    body: `${beneficiary.nickname} was added to your payees. Verify them before sending money.`,
  });

  revalidatePath("/dashboard/beneficiaries");
  return { success: true };
}

/**
 * Mock verification — a real platform would run micro-deposits or an
 * interbank lookup here. This simulates that check completing instantly.
 */
export async function verifyBeneficiaryAction(
  beneficiaryId: string
): Promise<BeneficiaryActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, userId: user.id },
  });
  if (!beneficiary) {
    return { success: false, error: "Payee not found." };
  }

  await prisma.beneficiary.update({
    where: { id: beneficiary.id },
    data: { status: "VERIFIED" },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "BENEFICIARY_VERIFIED",
    entityType: "Beneficiary",
    entityId: beneficiary.id,
    ipAddress,
    userAgent,
  });

  revalidatePath("/dashboard/beneficiaries");
  return { success: true };
}

export async function removeBeneficiaryAction(
  beneficiaryId: string
): Promise<BeneficiaryActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { id: beneficiaryId, userId: user.id },
  });
  if (!beneficiary) {
    return { success: false, error: "Payee not found." };
  }

  await prisma.beneficiary.delete({ where: { id: beneficiary.id } });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "BENEFICIARY_REMOVED",
    entityType: "Beneficiary",
    entityId: beneficiary.id,
    ipAddress,
    userAgent,
  });

  revalidatePath("/dashboard/beneficiaries");
  return { success: true };
}

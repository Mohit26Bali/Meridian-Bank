"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireStaffUser, canManageUsers } from "@/lib/auth/admin";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { notifyUser } from "@/lib/notifications";
import { kycReviewSchema, type KycReviewInput } from "@/lib/validations/admin";

export type AdminActionResult = { success: true } | { success: false; error: string };

export async function reviewKycAction(input: KycReviewInput): Promise<AdminActionResult> {
  const staff = await requireStaffUser();
  if (!canManageUsers(staff.role)) {
    return { success: false, error: "You don't have permission to review KYC submissions." };
  }

  const parsed = kycReviewSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request." };
  }

  if (parsed.data.decision === "REJECTED" && !parsed.data.rejectionReason) {
    return { success: false, error: "A rejection reason is required." };
  }

  const kyc = await prisma.kyc.findUnique({ where: { id: parsed.data.kycId } });
  if (!kyc) return { success: false, error: "KYC submission not found." };
  if (kyc.status !== "PENDING") {
    return { success: false, error: "This submission has already been reviewed." };
  }

  await prisma.kyc.update({
    where: { id: kyc.id },
    data: {
      status: parsed.data.decision,
      reviewedAt: new Date(),
      reviewedById: staff.id,
      rejectionReason: parsed.data.decision === "REJECTED" ? parsed.data.rejectionReason : null,
    },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: staff.id,
    action: parsed.data.decision === "VERIFIED" ? "ADMIN_KYC_APPROVED" : "ADMIN_KYC_REJECTED",
    entityType: "Kyc",
    entityId: kyc.userId,
    ipAddress,
    userAgent,
    metadata: { rejectionReason: parsed.data.rejectionReason ?? "" },
  });

  await notifyUser({
    userId: kyc.userId,
    category: "SYSTEM",
    title: parsed.data.decision === "VERIFIED" ? "Identity verified" : "Verification rejected",
    body:
      parsed.data.decision === "VERIFIED"
        ? "Your identity documents have been verified. Your account now has full access."
        : `Your KYC submission was rejected. Reason: ${parsed.data.rejectionReason}. Please resubmit with corrected documents.`,
  });

  revalidatePath("/admin/kyc");
  return { success: true };
}

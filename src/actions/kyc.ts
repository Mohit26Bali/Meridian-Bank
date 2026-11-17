"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { notifyUser } from "@/lib/notifications";
import { kycSubmissionSchema, type KycSubmissionInput } from "@/lib/validations/kyc";

export type KycActionResult = { success: true } | { success: false; error: string };

export async function submitKycAction(input: KycSubmissionInput): Promise<KycActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const parsed = kycSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Check the KYC form for errors.",
    };
  }

  const { success: withinLimit } = checkRateLimit(
    `kyc-submit:${user.id}`,
    RATE_LIMITS.KYC_SUBMIT.limit,
    RATE_LIMITS.KYC_SUBMIT.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many submissions. Please try again later." };
  }

  const existing = await prisma.kyc.findUnique({ where: { userId: user.id } });
  if (existing?.status === "VERIFIED") {
    return { success: false, error: "Your identity is already verified." };
  }
  if (existing?.status === "PENDING") {
    return { success: false, error: "Your submission is already under review." };
  }

  const { pan, aadhaar, panDocument, aadhaarDocument, selfie, addressProof } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const kyc = await tx.kyc.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        pan,
        aadhaar,
        status: "PENDING",
        submittedAt: new Date(),
      },
      update: {
        pan,
        aadhaar,
        status: "PENDING",
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      },
    });

    await tx.kycDocument.deleteMany({ where: { kycId: kyc.id } });

    // Mock OCR: in production this would call a real document-intelligence
    // service. Here it just echoes back the typed values as "extracted" data.
    await tx.kycDocument.createMany({
      data: [
        {
          kycId: kyc.id,
          type: "PAN",
          fileUrl: panDocument,
          ocrExtracted: { simulated: true, extractedPan: pan },
        },
        {
          kycId: kyc.id,
          type: "AADHAAR",
          fileUrl: aadhaarDocument,
          ocrExtracted: { simulated: true, extractedAadhaar: aadhaar },
        },
        { kycId: kyc.id, type: "SELFIE", fileUrl: selfie },
        { kycId: kyc.id, type: "ADDRESS_PROOF", fileUrl: addressProof },
      ],
    });
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: user.id,
    action: "KYC_SUBMITTED",
    entityType: "Kyc",
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  await notifyUser({
    userId: user.id,
    category: "SYSTEM",
    title: "KYC submitted",
    body: "Your identity documents were submitted and are pending review.",
  });

  revalidatePath("/dashboard/profile");
  return { success: true };
}

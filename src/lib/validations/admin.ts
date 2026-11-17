import { z } from "zod";

export const updateUserStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["ACTIVE", "SUSPENDED", "LOCKED", "CLOSED"]),
  reason: z.string().trim().max(500).optional(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["CUSTOMER", "SUPPORT_AGENT", "AUDITOR", "ADMIN", "SUPER_ADMIN"]),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const kycReviewSchema = z.object({
  kycId: z.string().uuid(),
  decision: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().trim().max(500).optional(),
});
export type KycReviewInput = z.infer<typeof kycReviewSchema>;

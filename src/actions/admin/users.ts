"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireStaffUser, canManageUsers, canManageRoles } from "@/lib/auth/admin";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";
import { checkRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { notifyUser } from "@/lib/notifications";
import {
  updateUserStatusSchema,
  updateUserRoleSchema,
  type UpdateUserStatusInput,
  type UpdateUserRoleInput,
} from "@/lib/validations/admin";

export type AdminActionResult = { success: true } | { success: false; error: string };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "reactivated",
  SUSPENDED: "suspended",
  LOCKED: "locked",
  CLOSED: "closed",
};

export async function updateUserStatusAction(
  input: UpdateUserStatusInput
): Promise<AdminActionResult> {
  const staff = await requireStaffUser();
  if (!canManageUsers(staff.role)) {
    return { success: false, error: "You don't have permission to manage users." };
  }

  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request." };
  }

  const { success: withinLimit } = checkRateLimit(
    `admin-action:${staff.id}`,
    RATE_LIMITS.ADMIN_ACTION.limit,
    RATE_LIMITS.ADMIN_ACTION.windowMs
  );
  if (!withinLimit) {
    return { success: false, error: "Too many actions. Please slow down." };
  }

  if (parsed.data.userId === staff.id) {
    return { success: false, error: "You can't change your own account status." };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { success: false, error: "User not found." };

  if (target.role !== "CUSTOMER" && !canManageRoles(staff.role)) {
    return { success: false, error: "Only super admins can modify staff accounts." };
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status !== "LOCKED" ? { failedLoginAttempts: 0, lockedUntil: null } : {}),
    },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: staff.id,
    action: "ADMIN_USER_STATUS_CHANGED",
    entityType: "User",
    entityId: target.id,
    ipAddress,
    userAgent,
    metadata: { newStatus: parsed.data.status, reason: parsed.data.reason ?? "" },
  });

  await notifyUser({
    userId: target.id,
    category: "SECURITY",
    title: "Account status updated",
    body: `Your account was ${STATUS_LABEL[parsed.data.status] ?? "updated"} by our team.${
      parsed.data.reason ? ` Reason: ${parsed.data.reason}` : ""
    }`,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

export async function updateUserRoleAction(
  input: UpdateUserRoleInput
): Promise<AdminActionResult> {
  const staff = await requireStaffUser();
  if (!canManageRoles(staff.role)) {
    return { success: false, error: "Only super admins can change roles." };
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid request." };
  }

  if (parsed.data.userId === staff.id) {
    return { success: false, error: "You can't change your own role." };
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { success: false, error: "User not found." };

  await prisma.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  const { ipAddress, userAgent } = await getRequestContext();
  await writeAuditLog({
    userId: staff.id,
    action: "ADMIN_USER_ROLE_CHANGED",
    entityType: "User",
    entityId: target.id,
    ipAddress,
    userAgent,
    metadata: { previousRole: target.role, newRole: parsed.data.role },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${target.id}`);
  return { success: true };
}

import "server-only";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";

const STAFF_ROLES: UserRole[] = ["SUPPORT_AGENT", "AUDITOR", "ADMIN", "SUPER_ADMIN"];

export function isStaffRole(role: UserRole) {
  return STAFF_ROLES.includes(role);
}

/** Roles that may suspend/activate/lock users and review KYC submissions. */
export function canManageUsers(role: UserRole) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Only super admins may change another staff member's role. */
export function canManageRoles(role: UserRole) {
  return role === "SUPER_ADMIN";
}

/** Auditors and above may read the audit log. */
export function canViewAuditLogs(role: UserRole) {
  return role === "AUDITOR" || role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function requireStaffUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/session-expired");
  }
  if (!isStaffRole(user.role)) {
    redirect("/dashboard");
  }
  return user;
}

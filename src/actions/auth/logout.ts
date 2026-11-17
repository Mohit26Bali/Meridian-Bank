"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { revokeCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/security/audit";
import { getRequestContext } from "@/lib/security/request-context";

export async function logoutAction() {
  const user = await getCurrentUser();
  const { ipAddress, userAgent } = await getRequestContext();

  await revokeCurrentSession();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: user.id,
      ipAddress,
      userAgent,
    });
  }

  redirect("/login");
}

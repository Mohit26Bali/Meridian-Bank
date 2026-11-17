"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export type NotificationActionResult = { success: true } | { success: false; error: string };

export async function markNotificationReadAction(
  notificationId: string
): Promise<NotificationActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId: user.id },
  });
  if (!notification) return { success: false, error: "Notification not found." };

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: notification.readAt ?? new Date() },
  });

  revalidatePath("/dashboard/notifications");
  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Please log in again." };

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/dashboard/notifications");
  return { success: true };
}

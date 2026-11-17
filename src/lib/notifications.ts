import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { NotificationCategory, Prisma } from "@prisma/client";

/**
 * Records an in-app notification. Email/SMS/push are separate channels this
 * mock platform doesn't actually deliver to — every notification here is
 * IN_APP so it always has somewhere real to show up.
 */
export async function getNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function notifyUser(input: {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  metadata?: Record<string, Prisma.InputJsonValue>;
}) {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      category: input.category,
      channel: "IN_APP",
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    },
  });
}

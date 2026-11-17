import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getNotificationsForUser } from "@/lib/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/empty-state";
import { NotificationRow } from "@/components/app/notification-row";
import { MarkAllReadButton } from "@/components/app/mark-all-read-button";

export const metadata: Metadata = { title: "Notifications" };

const CATEGORIES = [
  { value: undefined, label: "All" },
  { value: "SECURITY", label: "Security" },
  { value: "TRANSACTION", label: "Transactions" },
  { value: "OFFER", label: "Offers" },
  { value: "SYSTEM", label: "System" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const notifications = await getNotificationsForUser(user.id);
  const filtered = category
    ? notifications.filter((n) => n.category === category)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link key={c.label} href={c.value ? `?category=${c.value}` : "?"}>
            <Badge
              variant={
                (c.value ?? undefined) === category || (!c.value && !category)
                  ? "default"
                  : "outline"
              }
              className="cursor-pointer px-3 py-1"
            >
              {c.label}
            </Badge>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Security alerts, transaction updates, and account news will show up here."
            />
          ) : (
            filtered.map((n) => (
              <NotificationRow
                key={n.id}
                id={n.id}
                category={n.category}
                title={n.title}
                body={n.body}
                createdAt={n.createdAt.toISOString()}
                readAt={n.readAt?.toISOString() ?? null}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

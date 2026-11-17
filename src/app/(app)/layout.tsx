import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { Topbar } from "@/components/app/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/session-expired");
  }

  const unreadCount = await getUnreadNotificationCount(user.id);

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="border-border bg-card sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <Link
          href="/dashboard"
          className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 text-lg font-semibold tracking-tight"
        >
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" priority />
          Meridian Bank
        </Link>
        <SidebarNav />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
          }}
          unreadCount={unreadCount}
        />
        <main id="main-content" className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}

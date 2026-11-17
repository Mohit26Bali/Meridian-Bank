import Link from "next/link";
import Image from "next/image";
import { requireStaffUser } from "@/lib/auth/admin";
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { AdminTopbar } from "@/components/admin/admin-topbar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaffUser();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="border-border bg-card sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <Link
          href="/admin"
          className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 text-lg font-semibold tracking-tight"
        >
          <Image src="/logo-mark.png" alt="" width={32} height={32} className="size-8" priority />
          Meridian Admin
        </Link>
        <AdminSidebarNav role={staff.role} />
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopbar
          user={{
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email,
            role: staff.role,
          }}
        />
        <main id="main-content" className="flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}

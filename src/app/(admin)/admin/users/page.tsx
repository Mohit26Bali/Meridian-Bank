import type { Metadata } from "next";
import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";

import { getUsers } from "@/lib/admin/queries";
import { formatDate } from "@/lib/banking/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserFilters } from "@/components/admin/user-filters";
import { PaginationBar } from "@/components/app/pagination-bar";
import { EmptyState } from "@/components/app/empty-state";
import type { UserRole, UserStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Manage Users" };

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PENDING_VERIFICATION: "secondary",
  SUSPENDED: "destructive",
  LOCKED: "destructive",
  CLOSED: "outline",
};

const KYC_LABEL: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  REQUIRES_REVIEW: "Needs review",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const { users, total } = await getUsers(
    {
      search: params.search,
      role: params.role as UserRole | undefined,
      status: params.status as UserStatus | undefined,
    },
    page,
    PAGE_SIZE
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(nextPage: number) {
    const next = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    next.set("page", String(nextPage));
    return `/admin/users?${next.toString()}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          {total.toLocaleString()} account{total === 1 ? "" : "s"} total.
        </p>
      </div>

      <UserFilters />

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UsersIcon}
                title="No users found"
                description="Try adjusting your search or filters."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                        {u.firstName} {u.lastName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.role.replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[u.status] ?? "outline"}>
                        {u.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {KYC_LABEL[u.kyc?.status ?? "NOT_SUBMITTED"]}
                    </TableCell>
                    <TableCell className="text-foreground-muted">
                      {formatDate(u.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScrollText } from "lucide-react";

import { getAuditLogs } from "@/lib/admin/queries";
import { requireStaffUser, canViewAuditLogs } from "@/lib/auth/admin";
import { formatDate } from "@/lib/banking/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuditLogFilters } from "@/components/admin/audit-log-filters";
import { PaginationBar } from "@/components/app/pagination-bar";
import { EmptyState } from "@/components/app/empty-state";

export const metadata: Metadata = { title: "Audit Logs" };

const PAGE_SIZE = 25;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requireStaffUser();
  if (!canViewAuditLogs(staff.role)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const { logs, total, distinctActions, distinctEntityTypes } = await getAuditLogs(
    {
      action: params.action,
      entityType: params.entityType,
      search: params.search,
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
    return `/admin/audit-logs?${next.toString()}`;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          {total.toLocaleString()} recorded event{total === 1 ? "" : "s"}.
        </p>
      </div>

      <AuditLogFilters actions={distinctActions} entityTypes={distinctEntityTypes} />

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ScrollText}
                title="No matching events"
                description="Try adjusting your filters."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.user ? (
                        <div>
                          <p className="font-medium">
                            {log.user.firstName} {log.user.lastName}
                          </p>
                          <p className="text-foreground-muted text-xs">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-foreground-muted">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action.toLowerCase().replaceAll("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-foreground-secondary">
                      {log.entityType}
                      {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ""}
                    </TableCell>
                    <TableCell className="text-foreground-muted">
                      {log.ipAddress ?? "—"}
                    </TableCell>
                    <TableCell className="text-foreground-muted">
                      {formatDate(log.createdAt)}
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

import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserCheck, FileCheck2, ArrowLeftRight, Wallet } from "lucide-react";

import { getAdminOverviewStats } from "@/lib/admin/queries";
import { formatCurrency, formatDate } from "@/lib/banking/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/fade-in";

export const metadata: Metadata = { title: "Admin Overview" };

const ACTION_LABEL: Record<string, string> = {
  ADMIN_USER_STATUS_CHANGED: "changed account status of",
  ADMIN_USER_ROLE_CHANGED: "changed role of",
  ADMIN_KYC_APPROVED: "approved KYC for",
  ADMIN_KYC_REJECTED: "rejected KYC for",
  USER_LOGIN: "signed in",
  KYC_SUBMITTED: "submitted KYC",
  PASSWORD_RESET: "reset password",
  TWO_FACTOR_ENABLED: "enabled 2FA",
  TWO_FACTOR_DISABLED: "disabled 2FA",
};

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  const cards = [
    { label: "Total customers", value: stats.totalUsers.toLocaleString(), icon: Users },
    { label: "Active customers", value: stats.activeUsers.toLocaleString(), icon: UserCheck },
    {
      label: "Total balance across bank",
      value: formatCurrency(stats.totalBalance),
      icon: Wallet,
    },
    {
      label: "Transactions today",
      value: stats.transactionsToday.toLocaleString(),
      icon: ArrowLeftRight,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <FadeIn>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          Bank-wide activity, at a glance.
        </p>
      </FadeIn>

      <FadeIn delay={0.05} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-start justify-between gap-3 pt-5">
              <div>
                <p className="text-foreground-secondary text-xs">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{card.value}</p>
              </div>
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <card.icon className="size-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </FadeIn>

      {stats.pendingKycCount > 0 && (
        <FadeIn delay={0.1}>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex items-center justify-between gap-3 pt-5">
              <div className="flex items-center gap-3">
                <div className="bg-warning/15 text-warning flex size-10 items-center justify-center rounded-xl">
                  <FileCheck2 className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {stats.pendingKycCount} KYC submission{stats.pendingKycCount === 1 ? "" : "s"}{" "}
                    awaiting review
                  </p>
                  <p className="text-foreground-secondary text-xs">
                    Review identity documents to approve or reject.
                  </p>
                </div>
              </div>
              <Button asChild size="sm">
                <Link href="/admin/kyc">Review now</Link>
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.recentAuditLogs.length === 0 ? (
              <p className="text-foreground-muted text-sm">No activity recorded yet.</p>
            ) : (
              stats.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-border flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0"
                >
                  <p>
                    <span className="font-medium">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : "System"}
                    </span>{" "}
                    <span className="text-foreground-secondary">
                      {ACTION_LABEL[log.action] ?? log.action.toLowerCase().replaceAll("_", " ")}
                    </span>{" "}
                    <span className="text-foreground-muted">{log.entityType}</span>
                  </p>
                  <span className="text-foreground-muted shrink-0 text-xs">
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              ))
            )}
            <Button asChild variant="outline" size="sm" className="mt-1 self-start">
              <Link href="/admin/audit-logs">View all audit logs</Link>
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

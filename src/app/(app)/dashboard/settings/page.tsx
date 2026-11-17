import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck, ShieldOff } from "lucide-react";

import {
  getCurrentUser,
  getActiveSessionsForUser,
  getCurrentSessionId,
} from "@/lib/auth/session";
import { getLoginHistoryForUser } from "@/actions/security";
import { formatDate } from "@/lib/banking/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { TwoFactorSetupDialog } from "@/components/app/two-factor-setup-dialog";
import { TwoFactorDisableDialog } from "@/components/app/two-factor-disable-dialog";
import { SessionRow } from "@/components/app/session-row";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [sessions, currentSessionId, loginHistory] = await Promise.all([
    getActiveSessionsForUser(user.id),
    getCurrentSessionId(),
    getLoginHistoryForUser(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Two-factor authentication</CardTitle>
            <CardDescription>
              Require a code from an authenticator app when signing in.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={user.twoFactorEnabled ? "secondary" : "outline"}>
              {user.twoFactorEnabled ? (
                <>
                  <ShieldCheck className="size-3" /> Enabled
                </>
              ) : (
                <>
                  <ShieldOff className="size-3" /> Disabled
                </>
              )}
            </Badge>
            {user.twoFactorEnabled ? <TwoFactorDisableDialog /> : <TwoFactorSetupDialog />}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Devices currently signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              id={session.id}
              isCurrent={session.id === currentSessionId}
              ipAddress={session.ipAddress}
              userAgent={session.userAgent}
              updatedAt={session.updatedAt.toISOString()}
              expiresAt={session.expiresAt.toISOString()}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login history</CardTitle>
          <CardDescription>Recent sign-in attempts on your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          {loginHistory.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
            >
              <div>
                <p className="font-medium">{entry.ipAddress ?? "Unknown IP"}</p>
                <p className="text-foreground-muted text-xs">{formatDate(entry.createdAt)}</p>
              </div>
              <Badge variant={entry.successful ? "secondary" : "destructive"}>
                {entry.successful ? "Success" : entry.reason?.replace(/_/g, " ") ?? "Failed"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

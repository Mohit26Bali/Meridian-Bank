import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getUserDetail } from "@/lib/admin/queries";
import { requireStaffUser, canManageUsers, canManageRoles } from "@/lib/auth/admin";
import { formatCurrency, formatDate, ACCOUNT_TYPE_LABEL, maskAccountNumber } from "@/lib/banking/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserStatusDialog } from "@/components/admin/user-status-dialog";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { KycReviewActions } from "@/components/admin/kyc-review-actions";

export const metadata: Metadata = { title: "User Detail" };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  PENDING_VERIFICATION: "secondary",
  SUSPENDED: "destructive",
  LOCKED: "destructive",
  CLOSED: "outline",
};

const DOC_LABEL: Record<string, string> = {
  PAN: "PAN card",
  AADHAAR: "Aadhaar card",
  SELFIE: "Selfie",
  ADDRESS_PROOF: "Address proof",
};

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const staff = await requireStaffUser();
  const { userId } = await params;
  const user = await getUserDetail(userId);
  if (!user) notFound();

  const canManage = canManageUsers(staff.role);
  const canChangeRole = canManageRoles(staff.role) && staff.id !== user.id;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                {initialsOf(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {user.firstName} {user.lastName}
              </h1>
              <p className="text-foreground-secondary text-sm">{user.email}</p>
              <p className="text-foreground-muted text-xs">{user.phone}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{user.role.replaceAll("_", " ")}</Badge>
            <Badge variant={STATUS_VARIANT[user.status] ?? "outline"}>
              {user.status.replaceAll("_", " ")}
            </Badge>
          </div>
        </CardContent>

        {(canManage || canChangeRole) && (
          <CardContent className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            {canManage && <UserStatusDialog userId={user.id} currentStatus={user.status} />}
            {canChangeRole && <UserRoleSelect userId={user.id} role={user.role} />}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {user.accounts.length === 0 ? (
            <p className="text-foreground-muted text-sm">No accounts.</p>
          ) : (
            user.accounts.map((account) => (
              <div
                key={account.id}
                className="border-border flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}
                  </p>
                  <p className="text-foreground-muted text-xs">
                    {maskAccountNumber(account.accountNumber)} &middot; {account.status}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(account.balance.toString())}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!user.kyc || user.kyc.status === "NOT_SUBMITTED" ? (
            <p className="text-foreground-muted text-sm">No KYC submission yet.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    PAN {user.kyc.pan} &middot; Aadhaar {user.kyc.aadhaar}
                  </p>
                  <p className="text-foreground-muted text-xs">
                    Submitted {user.kyc.submittedAt ? formatDate(user.kyc.submittedAt) : "—"}
                  </p>
                </div>
                <Badge variant={user.kyc.status === "VERIFIED" ? "default" : user.kyc.status === "REJECTED" ? "destructive" : "secondary"}>
                  {user.kyc.status.replaceAll("_", " ")}
                </Badge>
              </div>

              {user.kyc.rejectionReason && (
                <p className="text-destructive text-xs">Reason: {user.kyc.rejectionReason}</p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {user.kyc.documents.map((doc) => (
                  <div key={doc.id} className="space-y-1">
                    <Image
                      src={doc.fileUrl}
                      alt={DOC_LABEL[doc.type] ?? doc.type}
                      width={200}
                      height={96}
                      unoptimized
                      className="border-border h-24 w-full rounded-lg border object-cover"
                    />
                    <p className="text-foreground-muted text-center text-xs">
                      {DOC_LABEL[doc.type] ?? doc.type}
                    </p>
                  </div>
                ))}
              </div>

              {canManage && user.kyc.status === "PENDING" && (
                <KycReviewActions kycId={user.kyc.id} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent login history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {user.loginHistory.length === 0 ? (
            <p className="text-foreground-muted text-sm">No login history.</p>
          ) : (
            user.loginHistory.map((entry) => (
              <div
                key={entry.id}
                className="border-border flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0"
              >
                <span className={entry.successful ? "text-success" : "text-destructive"}>
                  {entry.successful ? "Successful sign-in" : `Failed sign-in — ${entry.reason ?? "unknown"}`}
                </span>
                <span className="text-foreground-muted text-xs">
                  {entry.ipAddress ?? "unknown IP"} &middot; {formatDate(entry.createdAt)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

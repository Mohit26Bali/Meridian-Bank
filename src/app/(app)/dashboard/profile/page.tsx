import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProfileForm } from "@/components/app/profile-form";
import { KycDialog } from "@/components/app/kyc-dialog";

export const metadata: Metadata = { title: "Profile" };

const KYC_STATUS_VARIANT: Record<string, "secondary" | "outline" | "destructive"> = {
  NOT_SUBMITTED: "outline",
  PENDING: "outline",
  VERIFIED: "secondary",
  REJECTED: "destructive",
  REQUIRES_REVIEW: "destructive",
};

const KYC_STATUS_LABEL: Record<string, string> = {
  NOT_SUBMITTED: "Not submitted",
  PENDING: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  REQUIRES_REVIEW: "Requires review",
};

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const kyc = await prisma.kyc.findUnique({ where: { userId: user.id } });
  const kycStatus = kyc?.status ?? "NOT_SUBMITTED";
  const canSubmitKyc = kycStatus === "NOT_SUBMITTED" || kycStatus === "REJECTED";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {initialsOf(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-foreground-secondary text-sm">{user.email}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Identity verification</CardTitle>
            <CardDescription>
              {kycStatus === "REJECTED" && kyc?.rejectionReason
                ? kyc.rejectionReason
                : "Required to unlock higher transfer limits."}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={KYC_STATUS_VARIANT[kycStatus]}>
              {KYC_STATUS_LABEL[kycStatus]}
            </Badge>
            {canSubmitKyc && <KycDialog />}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
          <CardDescription>
            {user.phone} &middot; Email address can&apos;t be changed here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            defaultValues={{
              firstName: user.firstName,
              lastName: user.lastName,
              dateOfBirth: user.dateOfBirth
                ? user.dateOfBirth.toISOString().slice(0, 10)
                : "",
              occupation: user.occupation ?? "",
              addressLine1: user.addressLine1 ?? "",
              addressLine2: user.addressLine2 ?? "",
              city: user.city ?? "",
              state: user.state ?? "",
              postalCode: user.postalCode ?? "",
              country: user.country ?? "",
              nomineeName: user.nomineeName ?? "",
              nomineeRelation: user.nomineeRelation ?? "",
              emergencyContact: user.emergencyContact ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

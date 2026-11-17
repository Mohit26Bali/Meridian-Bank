import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileCheck2 } from "lucide-react";

import { getPendingKycQueue } from "@/lib/admin/queries";
import { requireStaffUser, canManageUsers } from "@/lib/auth/admin";
import { formatDate } from "@/lib/banking/format";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { PaginationBar } from "@/components/app/pagination-bar";
import { KycReviewActions } from "@/components/admin/kyc-review-actions";

export const metadata: Metadata = { title: "KYC Review" };

const PAGE_SIZE = 10;

const DOC_LABEL: Record<string, string> = {
  PAN: "PAN card",
  AADHAAR: "Aadhaar card",
  SELFIE: "Selfie",
  ADDRESS_PROOF: "Address proof",
};

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requireStaffUser();
  const canManage = canManageUsers(staff.role);

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { items, total } = await getPendingKycQueue(page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">KYC review queue</h1>
        <p className="text-foreground-secondary mt-1 text-sm">
          {total} submission{total === 1 ? "" : "s"} awaiting review, oldest first.
        </p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={FileCheck2}
              title="Nothing to review"
              description="All KYC submissions have been processed."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((kyc) => (
            <Card key={kyc.id}>
              <CardContent className="flex flex-col gap-4 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/admin/users/${kyc.user.id}`}
                      className="font-medium hover:underline"
                    >
                      {kyc.user.firstName} {kyc.user.lastName}
                    </Link>
                    <p className="text-foreground-muted text-xs">{kyc.user.email}</p>
                  </div>
                  <p className="text-foreground-secondary text-xs">
                    Submitted {kyc.submittedAt ? formatDate(kyc.submittedAt) : "—"}
                  </p>
                </div>

                <p className="text-sm">
                  PAN <span className="font-medium">{kyc.pan}</span> &middot; Aadhaar{" "}
                  <span className="font-medium">{kyc.aadhaar}</span>
                </p>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {kyc.documents.map((doc) => (
                    <div key={doc.id} className="space-y-1">
                      <Image
                        src={doc.fileUrl}
                        alt={DOC_LABEL[doc.type] ?? doc.type}
                        width={200}
                        height={112}
                        unoptimized
                        className="border-border h-28 w-full rounded-lg border object-cover"
                      />
                      <p className="text-foreground-muted text-center text-xs">
                        {DOC_LABEL[doc.type] ?? doc.type}
                      </p>
                    </div>
                  ))}
                </div>

                {canManage && <KycReviewActions kycId={kyc.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PaginationBar
        page={page}
        totalPages={totalPages}
        buildHref={(next) => `/admin/kyc?page=${next}`}
      />
    </div>
  );
}

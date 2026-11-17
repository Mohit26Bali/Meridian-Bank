import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPendingVerificationUserId } from "@/lib/auth/pending-verification";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyPage() {
  const pendingUserId = await getPendingVerificationUserId();
  if (!pendingUserId) {
    redirect("/signup");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          We sent a 6-digit verification code. It expires in 5 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyForm />
      </CardContent>
    </Card>
  );
}

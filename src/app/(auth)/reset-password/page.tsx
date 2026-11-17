import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password you haven&apos;t used before.</CardDescription>
      </CardHeader>
      <CardContent>
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              This reset link is missing its token. Please use the link from your email.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

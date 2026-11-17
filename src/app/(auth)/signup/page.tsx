import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Open an account" };

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Open your account</CardTitle>
        <CardDescription>
          Takes about two minutes. No paperwork.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
        <p className="text-foreground-secondary mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

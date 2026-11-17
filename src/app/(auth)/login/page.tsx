import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Log in to manage your accounts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="text-foreground-secondary mt-6 text-center text-sm">
          New to Meridian?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Open an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

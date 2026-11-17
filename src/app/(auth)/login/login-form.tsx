"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { totpTokenSchema, type TotpTokenInput } from "@/lib/validations/two-factor";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { loginAction } from "@/actions/auth/login";
import { confirmLogin2FAAction } from "@/actions/two-factor";

export function LoginForm() {
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");

  if (step === "2fa") {
    return <TwoFactorStep />;
  }

  return <CredentialsStep onRequires2FA={() => setStep("2fa")} />;
}

function CredentialsStep({ onRequires2FA }: { onRequires2FA: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  function onSubmit(values: LoginInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values);

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      if (result.requiresVerification) {
        router.push("/verify");
        return;
      }

      if (result.requires2FA) {
        onRequires2FA();
        return;
      }

      const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-primary text-xs font-medium hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rememberMe"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="size-4 rounded border-border"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <label htmlFor="rememberMe" className="text-foreground-secondary text-sm">
                  Remember me on this device
                </label>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Log in
        </Button>
      </form>
    </Form>
  );
}

function TwoFactorStep() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<TotpTokenInput>({
    resolver: zodResolver(totpTokenSchema),
    defaultValues: { token: "" },
  });

  function onSubmit(values: TotpTokenInput) {
    setError(null);
    startTransition(async () => {
      const result = await confirmLogin2FAAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-foreground-secondary text-sm">
          Enter the 6-digit code from your authenticator app.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="token"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Authentication code</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  className="text-center text-lg tracking-[0.5em]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Verify
        </Button>
      </form>
    </Form>
  );
}

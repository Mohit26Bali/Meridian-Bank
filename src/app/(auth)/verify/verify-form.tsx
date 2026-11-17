"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { otpSchema } from "@/lib/validations/auth";
import { z } from "zod";
import {
  verifyEmailAction,
  resendVerificationOtpAction,
} from "@/actions/auth/verify-email";

type OtpInput = z.infer<typeof otpSchema>;

export function VerifyForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isResending, startResendTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const form = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  function onSubmit(values: OtpInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await verifyEmailAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  function onResend() {
    setFormError(null);
    setResendMessage(null);
    startResendTransition(async () => {
      const result = await resendVerificationOtpAction();
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setResendMessage("A new code has been sent.");
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
        {resendMessage && (
          <Alert>
            <AlertDescription>{resendMessage}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification code</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
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

        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={isResending}
          onClick={onResend}
        >
          {isResending && <Loader2 className="animate-spin" />}
          Resend code
        </Button>
      </form>
    </Form>
  );
}

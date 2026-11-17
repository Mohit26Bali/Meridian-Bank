"use client";

import { useState, useTransition } from "react";
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
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { z } from "zod";
import { forgotPasswordAction } from "@/actions/auth/forgot-password";

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: ForgotPasswordInput) {
    startTransition(async () => {
      await forgotPasswordAction(values);
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          If an account exists for that email, a reset link is on its way.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Send reset link
        </Button>
      </form>
    </Form>
  );
}

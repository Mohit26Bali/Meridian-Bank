"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { changePinSchema, type ChangePinInput } from "@/lib/validations/cards";
import { otpSchema } from "@/lib/validations/auth";
import {
  initiatePinChangeAction,
  confirmPinChangeAction,
  resendPinChangeOtpAction,
} from "@/actions/banking/cards";

type Step = "form" | "otp" | "done";

export function ChangePinDialog({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");

  function reset(next: boolean) {
    setOpen(next);
    if (!next) setStep("form");
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound />
          Change PIN
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-success size-10" />
            <p className="font-medium">PIN updated</p>
            <Button onClick={() => reset(false)}>Done</Button>
          </div>
        ) : step === "otp" ? (
          <OtpStep onBack={() => setStep("form")} onConfirmed={() => setStep("done")} />
        ) : (
          <PinForm cardId={cardId} onInitiated={() => setStep("otp")} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PinForm({
  cardId,
  onInitiated,
}: {
  cardId: string;
  onInitiated: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ChangePinInput>({
    resolver: zodResolver(changePinSchema),
    defaultValues: { cardId, pin: "", confirmPin: "" },
  });

  function onSubmit(values: ChangePinInput) {
    setError(null);
    startTransition(async () => {
      const result = await initiatePinChangeAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onInitiated();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change your card PIN</DialogTitle>
        <DialogDescription>
          Choose a new 4-digit PIN. We&apos;ll confirm this with a one-time
          code.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField
            control={form.control}
            name="pin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New PIN</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="text-center tracking-[0.5em]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm PIN</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="text-center tracking-[0.5em]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Continue
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function OtpStep({
  onBack,
  onConfirmed,
}: {
  onBack: () => void;
  onConfirmed: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isResending, startResend] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const form = useForm<{ code: string }>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  function onSubmit(values: { code: string }) {
    setError(null);
    startTransition(async () => {
      const result = await confirmPinChangeAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onConfirmed();
    });
  }

  function onResend() {
    setError(null);
    setResendMessage(null);
    startResend(async () => {
      const result = await resendPinChangeOtpAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setResendMessage("A new code has been sent.");
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Confirm PIN change</DialogTitle>
        <DialogDescription>
          Enter the 6-digit code we sent to confirm this change.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
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
                    autoComplete="one-time-code"
                    className="text-center text-lg tracking-[0.5em]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Confirm
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
          </DialogFooter>
        </form>
      </Form>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Back
      </Button>
    </>
  );
}

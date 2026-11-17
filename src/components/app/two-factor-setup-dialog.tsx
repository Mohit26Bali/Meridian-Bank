"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

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
import { totpTokenSchema, type TotpTokenInput } from "@/lib/validations/two-factor";
import { setupTwoFactorAction, verifyTwoFactorSetupAction } from "@/actions/two-factor";

type Step = "start" | "scan" | "done";

export function TwoFactorSetupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("start");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [isStarting, startStart] = useTransition();
  const [isVerifying, startVerify] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<TotpTokenInput>({
    resolver: zodResolver(totpTokenSchema),
    defaultValues: { token: "" },
  });

  function onStart() {
    setError(null);
    startStart(async () => {
      const result = await setupTwoFactorAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
      setStep("scan");
    });
  }

  function onVerify(values: TotpTokenInput) {
    setError(null);
    startVerify(async () => {
      const result = await verifyTwoFactorSetupAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStep("done");
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      if (step === "done") router.refresh();
      setStep("start");
      setQrCodeDataUrl(null);
      setSecret(null);
      setError(null);
      form.reset();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ShieldCheck />
          Enable 2FA
        </Button>
      </DialogTrigger>
      <DialogContent>
        {step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-success size-10" />
            <p className="font-medium">Two-factor authentication enabled</p>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : step === "scan" ? (
          <>
            <DialogHeader>
              <DialogTitle>Scan this QR code</DialogTitle>
              <DialogDescription>
                Scan with Google Authenticator, 1Password, or any TOTP app,
                then enter the code it generates.
              </DialogDescription>
            </DialogHeader>

            {qrCodeDataUrl && (
              <div className="flex justify-center">
                <Image
                  src={qrCodeDataUrl}
                  alt="Two-factor authentication QR code"
                  width={200}
                  height={200}
                  className="rounded-lg border border-border"
                  unoptimized
                />
              </div>
            )}

            {secret && (
              <p className="text-foreground-muted text-center font-mono text-xs break-all">
                {secret}
              </p>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onVerify)} className="space-y-4">
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
                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={isVerifying}>
                    {isVerifying && <Loader2 className="animate-spin" />}
                    Enable
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Set up two-factor authentication</DialogTitle>
              <DialogDescription>
                Add an extra layer of security. You&apos;ll need an
                authenticator app like Google Authenticator or 1Password.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button onClick={onStart} className="w-full" disabled={isStarting}>
                {isStarting && <Loader2 className="animate-spin" />}
                Get started
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

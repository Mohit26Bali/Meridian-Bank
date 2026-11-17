"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ArrowRightLeft,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  internalTransferSchema,
  beneficiaryTransferSchema,
  type InternalTransferInput,
  type BeneficiaryTransferInput,
} from "@/lib/validations/banking";
import { otpSchema } from "@/lib/validations/auth";
import {
  initiateInternalTransferAction,
  initiateBeneficiaryTransferAction,
  confirmTransferAction,
  resendTransferOtpAction,
} from "@/actions/banking/transfer";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  maskAccountNumber,
} from "@/lib/banking/format";

interface AccountOption {
  id: string;
  accountType: string;
  accountNumber: string;
  balance: string;
}

interface BeneficiaryOption {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber: string;
}

type Step = "form" | "otp" | "success";

export function TransferFlow({
  accounts,
  beneficiaries,
}: {
  accounts: AccountOption[];
  beneficiaries: BeneficiaryOption[];
}) {
  const [step, setStep] = useState<Step>("form");
  const [pendingConfirm, setPendingConfirm] = useState<
    | { kind: "internal"; values: InternalTransferInput }
    | { kind: "beneficiary"; values: BeneficiaryTransferInput }
    | null
  >(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ referenceNumber: string; amount: number; description: string } | null>(null);

  if (step === "success" && receipt) {
    return <TransferReceipt receipt={receipt} onDone={() => {
      setStep("form");
      setReceipt(null);
      setPendingConfirm(null);
    }} />;
  }

  if (step === "otp" && pendingConfirm) {
    return (
      <OtpStep
        onBack={() => setStep("form")}
        onConfirmed={(r) => {
          setReceipt(r);
          setStep("success");
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="internal">
        <TabsList>
          <TabsTrigger value="internal">
            <ArrowRightLeft className="size-4" />
            My accounts
          </TabsTrigger>
          <TabsTrigger value="beneficiary">
            <Send className="size-4" />
            To a payee
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internal">
          <InternalTransferForm
            accounts={accounts}
            duplicateWarning={duplicateWarning}
            onDuplicateWarning={setDuplicateWarning}
            onInitiated={(values) => {
              setPendingConfirm({ kind: "internal", values });
              setDuplicateWarning(null);
              setStep("otp");
            }}
          />
        </TabsContent>

        <TabsContent value="beneficiary">
          <BeneficiaryTransferForm
            accounts={accounts}
            beneficiaries={beneficiaries}
            duplicateWarning={duplicateWarning}
            onDuplicateWarning={setDuplicateWarning}
            onInitiated={(values) => {
              setPendingConfirm({ kind: "beneficiary", values });
              setDuplicateWarning(null);
              setStep("otp");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountSelectItems({ accounts }: { accounts: AccountOption[] }) {
  return (
    <>
      {accounts.map((a) => (
        <SelectItem key={a.id} value={a.id}>
          {ACCOUNT_TYPE_LABEL[a.accountType] ?? a.accountType} {maskAccountNumber(a.accountNumber)} &bull;{" "}
          {formatCurrency(a.balance)}
        </SelectItem>
      ))}
    </>
  );
}

function InternalTransferForm({
  accounts,
  duplicateWarning,
  onDuplicateWarning,
  onInitiated,
}: {
  accounts: AccountOption[];
  duplicateWarning: string | null;
  onDuplicateWarning: (v: string | null) => void;
  onInitiated: (values: InternalTransferInput) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<InternalTransferInput>({
    resolver: zodResolver(internalTransferSchema),
    defaultValues: {
      fromAccountId: accounts[0]?.id ?? "",
      toAccountId: accounts[1]?.id ?? "",
      amount: undefined,
      description: "",
    },
  });

  function submit(values: InternalTransferInput, confirmDuplicate = false) {
    setFormError(null);
    startTransition(async () => {
      const result = await initiateInternalTransferAction({ ...values, confirmDuplicate });
      if (!result.success) {
        if (result.duplicate) {
          onDuplicateWarning(result.error);
          return;
        }
        setFormError(result.error);
        return;
      }
      onInitiated(values);
    });
  }

  if (accounts.length < 2) {
    return (
      <Alert>
        <AlertDescription>
          You need at least two accounts to transfer between them.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => submit(v))} className="space-y-4 pt-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {duplicateWarning && (
          <Alert>
            <AlertDescription className="flex flex-col gap-2">
              {duplicateWarning}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => submit(form.getValues(), true)}
              >
                Send anyway
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="fromAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <AccountSelectItems accounts={accounts} />
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="toAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>To</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <AccountSelectItems accounts={accounts} />
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Moving to savings" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </form>
    </Form>
  );
}

function BeneficiaryTransferForm({
  accounts,
  beneficiaries,
  duplicateWarning,
  onDuplicateWarning,
  onInitiated,
}: {
  accounts: AccountOption[];
  beneficiaries: BeneficiaryOption[];
  duplicateWarning: string | null;
  onDuplicateWarning: (v: string | null) => void;
  onInitiated: (values: BeneficiaryTransferInput) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<BeneficiaryTransferInput>({
    resolver: zodResolver(beneficiaryTransferSchema),
    defaultValues: {
      fromAccountId: accounts[0]?.id ?? "",
      beneficiaryId: beneficiaries[0]?.id ?? "",
      amount: undefined,
      description: "",
    },
  });

  function submit(values: BeneficiaryTransferInput, confirmDuplicate = false) {
    setFormError(null);
    startTransition(async () => {
      const result = await initiateBeneficiaryTransferAction({ ...values, confirmDuplicate });
      if (!result.success) {
        if (result.duplicate) {
          onDuplicateWarning(result.error);
          return;
        }
        setFormError(result.error);
        return;
      }
      onInitiated(values);
    });
  }

  if (beneficiaries.length === 0) {
    return (
      <Alert>
        <AlertDescription className="flex flex-col gap-2">
          You don&apos;t have any verified payees yet.
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link href="/dashboard/beneficiaries">Add a payee</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => submit(v))} className="space-y-4 pt-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        {duplicateWarning && (
          <Alert>
            <AlertDescription className="flex flex-col gap-2">
              {duplicateWarning}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => submit(form.getValues(), true)}
              >
                Send anyway
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="fromAccountId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <AccountSelectItems accounts={accounts} />
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="beneficiaryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pay to</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a payee" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {beneficiaries.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nickname} &bull; {b.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Rent" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </form>
    </Form>
  );
}

function OtpStep({
  onBack,
  onConfirmed,
}: {
  onBack: () => void;
  onConfirmed: (receipt: { referenceNumber: string; amount: number; description: string }) => void;
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
      const result = await confirmTransferAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onConfirmed(result);
    });
  }

  function onResend() {
    setError(null);
    setResendMessage(null);
    startResend(async () => {
      const result = await resendTransferOtpAction();
      if (!result.success) {
        setError(result.error);
        return;
      }
      setResendMessage("A new code has been sent.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-primary size-5" />
        <p className="font-medium">Confirm this transfer</p>
      </div>
      <p className="text-foreground-secondary text-sm">
        Enter the 6-digit code we sent to confirm this transfer. It expires in
        5 minutes.
      </p>

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
            Confirm transfer
          </Button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              disabled={isResending}
              onClick={onResend}
            >
              {isResending && <Loader2 className="animate-spin" />}
              Resend code
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function TransferReceipt({
  receipt,
  onDone,
}: {
  receipt: { referenceNumber: string; amount: number; description: string };
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <CheckCircle2 className="text-success size-12" />
      <div>
        <p className="text-2xl font-semibold tracking-tight">
          {formatCurrency(receipt.amount)} sent
        </p>
        <p className="text-foreground-secondary mt-1 text-sm">{receipt.description}</p>
      </div>
      <Badge variant="secondary" className="font-mono">
        {receipt.referenceNumber}
      </Badge>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={onDone}>
          Make another transfer
        </Button>
        <Button asChild>
          <Link href="/dashboard/transactions">View transactions</Link>
        </Button>
      </div>
    </div>
  );
}

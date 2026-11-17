"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Landmark, Loader2, XCircle } from "lucide-react";

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
import { loanApplicationSchema, type LoanApplicationInput } from "@/lib/validations/loans";
import { applyForLoanAction } from "@/actions/banking/loans";
import { LOAN_TERMS, calculateEmi } from "@/lib/banking/loans";
import {
  ACCOUNT_TYPE_LABEL,
  formatCurrency,
  maskAccountNumber,
} from "@/lib/banking/format";

const LOAN_TYPE_LABEL: Record<string, string> = {
  PERSONAL: "Personal",
  HOME: "Home",
  AUTO: "Auto",
  EDUCATION: "Education",
  BUSINESS: "Business",
};

type Result =
  | { kind: "approved"; emiAmount: number }
  | { kind: "rejected"; reason: string };

export function ApplyLoanDialog({
  accounts,
}: {
  accounts: { id: string; accountType: string; accountNumber: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const form = useForm<LoanApplicationInput>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      type: "PERSONAL",
      principal: 10_000,
      termMonths: 24,
    },
  });

  const type = form.watch("type");
  const principal = form.watch("principal");
  const termMonths = form.watch("termMonths");
  const terms = LOAN_TERMS[type];
  const previewEmi = useMemo(
    () => calculateEmi(Number(principal) || 0, terms.aprPercent, Number(termMonths) || 1),
    [principal, termMonths, terms.aprPercent]
  );

  function onSubmit(values: LoanApplicationInput) {
    setFormError(null);
    startTransition(async () => {
      const res = await applyForLoanAction(values);
      if (!res.success) {
        setFormError(res.error);
        return;
      }
      if (res.approved) {
        setResult({ kind: "approved", emiAmount: res.emiAmount });
      } else {
        setResult({ kind: "rejected", reason: res.reason });
      }
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setFormError(null);
      setResult(null);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Landmark />
          Apply for a loan
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {result.kind === "approved" ? (
              <>
                <CheckCircle2 className="text-success size-12" />
                <p className="text-xl font-semibold">Approved and disbursed</p>
                <p className="text-foreground-secondary text-sm">
                  Your EMI is {formatCurrency(result.emiAmount)}/month.
                </p>
              </>
            ) : (
              <>
                <XCircle className="text-destructive size-12" />
                <p className="text-xl font-semibold">Not approved</p>
                <p className="text-foreground-secondary text-sm">{result.reason}</p>
              </>
            )}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Apply for a loan</DialogTitle>
              <DialogDescription>
                Mock instant underwriting — approval is decided immediately
                against the product&apos;s amount and term limits.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {formError && (
                  <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Disburse to</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {ACCOUNT_TYPE_LABEL[a.accountType] ?? a.accountType}{" "}
                              {maskAccountNumber(a.accountNumber)}
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(LOAN_TERMS).map((key) => (
                            <SelectItem key={key} value={key}>
                              {LOAN_TYPE_LABEL[key]} &bull; {LOAN_TERMS[key].aprPercent}% APR
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="principal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (months)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <p className="text-foreground-secondary text-sm">
                  Estimated EMI:{" "}
                  <span className="text-foreground font-medium">
                    {formatCurrency(Number.isFinite(previewEmi) ? previewEmi : 0)}/month
                  </span>
                </p>

                <DialogFooter>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending && <Loader2 className="animate-spin" />}
                    Submit application
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

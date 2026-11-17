"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LineChart, Loader2, Plus } from "lucide-react";

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
import {
  createInvestmentSchema,
  type CreateInvestmentInput,
} from "@/lib/validations/investments";
import { createInvestmentAction } from "@/actions/banking/investments";
import { INVESTMENT_TERMS } from "@/lib/banking/investments";
import {
  ACCOUNT_TYPE_LABEL,
  maskAccountNumber,
} from "@/lib/banking/format";

const TYPE_LABEL: Record<string, string> = {
  MUTUAL_FUND: "Mutual Fund",
  FIXED_DEPOSIT: "Fixed Deposit",
  RECURRING_DEPOSIT: "Recurring Deposit",
  STOCK: "Stocks",
};

export function CreateInvestmentDialog({
  accounts,
}: {
  accounts: { id: string; accountType: string; accountNumber: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CreateInvestmentInput>({
    resolver: zodResolver(createInvestmentSchema),
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      type: "MUTUAL_FUND",
      principal: 1000,
    },
  });

  const type = form.watch("type");
  const terms = INVESTMENT_TERMS[type];

  function onSubmit(values: CreateInvestmentInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createInvestmentAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setFormError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New investment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start an investment</DialogTitle>
          <DialogDescription>
            Simulated performance based on expected return rates — no real
            market orders are placed.
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
                  <FormLabel>Fund from</FormLabel>
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
                  <FormLabel>Investment type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.keys(INVESTMENT_TERMS).map((key) => (
                        <SelectItem key={key} value={key}>
                          <LineChart className="size-4" />
                          {TYPE_LABEL[key]} &bull; {INVESTMENT_TERMS[key].expectedReturnRate}%
                          expected
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
              name="principal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {terms.maturityMonths && (
              <p className="text-foreground-secondary text-sm">
                Matures in {terms.maturityMonths} months. Early withdrawal
                applies a {terms.earlyWithdrawalPenaltyPercent}% penalty.
              </p>
            )}

            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                Invest
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

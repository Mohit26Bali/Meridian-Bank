"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PiggyBank, Loader2, CheckCircle2 } from "lucide-react";

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
import { depositSchema, type DepositInput } from "@/lib/validations/banking";
import { depositAction } from "@/actions/banking/deposit";
import { ACCOUNT_TYPE_LABEL } from "@/lib/banking/format";

interface DepositDialogProps {
  accounts: { id: string; accountType: string; accountNumber: string }[];
}

export function DepositDialog({ accounts }: DepositDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      accountId: accounts[0]?.id ?? "",
      amount: undefined,
      description: "",
    },
  });

  function onSubmit(values: DepositInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await depositAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setSuccess(result.referenceNumber);
      router.refresh();
    });
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      form.reset();
      setFormError(null);
      setSuccess(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-col gap-1.5 h-auto py-4">
          <PiggyBank className="size-5" />
          <span className="text-xs font-medium">Deposit</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        {success ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-success size-10" />
            <div>
              <p className="font-medium">Deposit received</p>
              <p className="text-foreground-secondary text-sm">
                Reference {success}
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Make a deposit</DialogTitle>
              <DialogDescription>
                Simulated funding — no real money moves. Useful for trying out
                the platform.
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
                      <FormLabel>Deposit to</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose an account" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {ACCOUNT_TYPE_LABEL[account.accountType] ?? account.accountType}{" "}
                              &bull; &bull;&bull;&bull;&bull;{account.accountNumber.slice(-4)}
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
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          value={field.value ?? ""}
                        />
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
                        <Input placeholder="e.g. Paycheck" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="animate-spin" />}
                    Deposit funds
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { issueCardSchema, type IssueCardInput } from "@/lib/validations/cards";
import { issueCardAction } from "@/actions/banking/cards";
import { ACCOUNT_TYPE_LABEL, maskAccountNumber } from "@/lib/banking/format";
import { CardRevealDialog, type RevealedCard } from "./card-reveal-dialog";

export function IssueCardDialog({
  accounts,
}: {
  accounts: { id: string; accountType: string; accountNumber: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedCard | null>(null);

  const form = useForm<IssueCardInput>({
    resolver: zodResolver(issueCardSchema),
    defaultValues: { accountId: accounts[0]?.id ?? "", type: "DEBIT_VIRTUAL" },
  });

  function onSubmit(values: IssueCardInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await issueCardAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setOpen(false);
      form.reset();
      setRevealed(result.card);
    });
  }

  return (
    <>
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
            Issue card
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue a new card</DialogTitle>
            <DialogDescription>
              Virtual cards are ready to use instantly. Physical cards are
              simulated as active immediately in this demo.
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
                    <FormLabel>Link to account</FormLabel>
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
                    <FormLabel>Card type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DEBIT_VIRTUAL">
                          <CreditCard className="size-4" /> Virtual debit card
                        </SelectItem>
                        <SelectItem value="DEBIT_PHYSICAL">
                          <CreditCard className="size-4" /> Physical debit card
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending && <Loader2 className="animate-spin" />}
                  Issue card
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <CardRevealDialog
        card={revealed}
        onClose={() => {
          setRevealed(null);
          router.refresh();
        }}
      />
    </>
  );
}

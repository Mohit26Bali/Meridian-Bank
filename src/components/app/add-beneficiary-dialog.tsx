"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, Loader2 } from "lucide-react";

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
import { beneficiarySchema, type BeneficiaryInput } from "@/lib/validations/banking";
import { addBeneficiaryAction } from "@/actions/banking/beneficiaries";

export function AddBeneficiaryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<BeneficiaryInput>({
    resolver: zodResolver(beneficiarySchema),
    defaultValues: { nickname: "", bankName: "", accountNumber: "", ifsc: "" },
  });

  function onSubmit(values: BeneficiaryInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await addBeneficiaryAction(values);
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
          <UserPlus />
          Add payee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a payee</DialogTitle>
          <DialogDescription>
            Save their details once, then send money by nickname going
            forward. New payees need to be verified before you can send to them.
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
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mom, Landlord" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. First National Bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account number</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ifsc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IFSC code</FormLabel>
                  <FormControl>
                    <Input placeholder="ABCD0123456" className="uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending && <Loader2 className="animate-spin" />}
                Save payee
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

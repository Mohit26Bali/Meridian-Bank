"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { cardControlsSchema, type CardControlsInput } from "@/lib/validations/cards";
import { updateCardControlsAction } from "@/actions/banking/cards";

export function CardControlsDialog({
  cardId,
  dailyLimit,
  onlinePaymentsEnabled,
  internationalEnabled,
}: {
  cardId: string;
  dailyLimit: string;
  onlinePaymentsEnabled: boolean;
  internationalEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CardControlsInput>({
    resolver: zodResolver(cardControlsSchema),
    defaultValues: {
      cardId,
      dailyLimit: Number(dailyLimit),
      onlinePaymentsEnabled,
      internationalEnabled,
    },
  });

  function onSubmit(values: CardControlsInput) {
    setError(null);
    startTransition(async () => {
      const result = await updateCardControlsAction(values);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 />
          Controls
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Card controls</DialogTitle>
          <DialogDescription>
            Adjust spending limits and payment permissions for this card.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="dailyLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily spending limit</FormLabel>
                  <FormControl>
                    <Input type="number" step="1" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="onlinePaymentsEnabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="online-toggle">Online payments</Label>
                    <FormControl>
                      <Switch
                        id="online-toggle"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="internationalEnabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="intl-toggle">International payments</Label>
                    <FormControl>
                      <Switch
                        id="intl-toggle"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

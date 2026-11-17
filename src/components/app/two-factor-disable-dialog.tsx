"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { disableTwoFactorAction } from "@/actions/two-factor";

export function TwoFactorDisableDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await disableTwoFactorAction({ password });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setPassword("");
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPassword("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ShieldOff />
          Disable 2FA
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Enter your password to confirm. This will reduce your account&apos;s security.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="disable-2fa-password">Password</Label>
          <Input
            id="disable-2fa-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            className="w-full"
            onClick={onSubmit}
            disabled={isPending || !password}
          >
            {isPending && <Loader2 className="animate-spin" />}
            Disable
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

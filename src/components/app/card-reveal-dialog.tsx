"use client";

import { useState } from "react";
import { Copy, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface RevealedCard {
  number: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
}

function formatCardNumber(number: string) {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function CardRevealDialog({
  card,
  onClose,
}: {
  card: RevealedCard | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!card) return null;

  function copyNumber() {
    if (!card) return;
    navigator.clipboard.writeText(card.number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save these card details now</DialogTitle>
          <DialogDescription>
            For your security, the full number and CVV are shown only once
            and can&apos;t be retrieved again after you close this window.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-primary text-primary-foreground rounded-2xl p-5">
          <p className="font-mono text-lg tracking-wider">
            {formatCardNumber(card.number)}
          </p>
          <div className="mt-4 flex items-center gap-8 text-sm text-white">
            <div>
              <p className="text-xs">Expires</p>
              <p className="font-mono">
                {String(card.expiryMonth).padStart(2, "0")}/{String(card.expiryYear).slice(-2)}
              </p>
            </div>
            <div>
              <p className="text-xs">CVV</p>
              <p className="font-mono">{card.cvv}</p>
            </div>
          </div>
        </div>

        <Alert>
          <ShieldAlert />
          <AlertDescription>
            Store these somewhere safe, like a password manager. Meridian
            support will never ask you for your CVV.
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copyNumber}>
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy number"}
          </Button>
          <Button onClick={onClose}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

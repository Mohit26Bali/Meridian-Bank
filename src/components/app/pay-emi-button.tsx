"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { payEmiAction } from "@/actions/banking/loans";

export function PayEmiButton({ loanId }: { loanId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await payEmiAction({ loanId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button onClick={onClick} disabled={isPending}>
        {isPending ? <Loader2 className="animate-spin" /> : <CircleDollarSign />}
        Pay next EMI
      </Button>
    </div>
  );
}

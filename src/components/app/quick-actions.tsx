import Link from "next/link";
import { Send, Receipt, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DepositDialog } from "@/components/app/deposit-dialog";

export function QuickActions({
  accounts,
}: {
  accounts: { id: string; accountType: string; accountNumber: string }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
        <Link href="/dashboard/transfer">
          <Send className="size-5" />
          <span className="text-xs font-medium">Transfer</span>
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
        <Link href="/dashboard/transfer">
          <Receipt className="size-5" />
          <span className="text-xs font-medium">Pay Bills</span>
        </Link>
      </Button>
      <Button asChild variant="outline" className="h-auto flex-col gap-1.5 py-4">
        <Link href="/dashboard/beneficiaries">
          <UserPlus className="size-5" />
          <span className="text-xs font-medium">Add Payee</span>
        </Link>
      </Button>
      <DepositDialog accounts={accounts} />
    </div>
  );
}

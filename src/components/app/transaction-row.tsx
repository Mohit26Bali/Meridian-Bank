import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Receipt,
  RefreshCcw,
  Percent,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  TRANSACTION_TYPE_LABEL,
} from "@/lib/banking/format";

const TYPE_ICON: Record<string, typeof ArrowDownLeft> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  TRANSFER: RefreshCcw,
  BILL_PAYMENT: Receipt,
  INTEREST: Percent,
  REFUND: ArrowDownLeft,
  CHARGE: Landmark,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  COMPLETED: "secondary",
  PENDING: "outline",
  PROCESSING: "outline",
  FAILED: "destructive",
  REVERSED: "destructive",
  CANCELLED: "destructive",
};

interface TransactionRowProps {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  description: string | null;
  createdAt: Date | string;
  referenceNumber: string;
  isIncoming: boolean;
}

export function TransactionRow({
  type,
  status,
  amount,
  description,
  createdAt,
  referenceNumber,
  isIncoming,
}: TransactionRowProps) {
  const Icon = TYPE_ICON[type] ?? Receipt;

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted">
      <div
        className={
          isIncoming
            ? "bg-success/10 text-success flex size-10 shrink-0 items-center justify-center rounded-full"
            : "bg-muted text-foreground-secondary flex size-10 shrink-0 items-center justify-center rounded-full"
        }
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {description || TRANSACTION_TYPE_LABEL[type] || type}
        </p>
        <p className="text-foreground-muted truncate text-xs">
          {referenceNumber} &middot; {formatDate(createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={
            isIncoming ? "text-success text-sm font-semibold" : "text-sm font-semibold"
          }
        >
          {isIncoming ? "+" : "-"}
          {formatCurrency(amount)}
        </span>
        <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="text-[10px]">
          {status}
        </Badge>
      </div>
    </div>
  );
}

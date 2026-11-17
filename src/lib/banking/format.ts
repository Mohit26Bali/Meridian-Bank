export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  SAVINGS: "Savings",
  CURRENT: "Checking",
  SALARY: "Salary",
  BUSINESS: "Business",
  JOINT: "Joint",
  FIXED_DEPOSIT: "Fixed Deposit",
};

export const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER: "Transfer",
  BILL_PAYMENT: "Bill Payment",
  INTEREST: "Interest",
  REFUND: "Refund",
  CHARGE: "Charge",
};

export const TRANSACTION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REVERSED: "Reversed",
  CANCELLED: "Cancelled",
};

export function formatCurrency(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export function maskAccountNumber(accountNumber: string) {
  return `••••${accountNumber.slice(-4)}`;
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

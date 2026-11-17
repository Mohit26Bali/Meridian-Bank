import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTransactionsForUser } from "@/lib/banking/queries";
import type { TransactionType, TransactionStatus } from "@prisma/client";

const EXPORT_ROW_CAP = 5000;

function toCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;

  const { transactions } = await getTransactionsForUser(
    user.id,
    {
      accountId: searchParams.get("accountId") ?? undefined,
      type: (searchParams.get("type") as TransactionType) ?? undefined,
      status: (searchParams.get("status") as TransactionStatus) ?? undefined,
      search: searchParams.get("search") ?? undefined,
    },
    1,
    EXPORT_ROW_CAP
  );

  const header = [
    "Reference",
    "Type",
    "Status",
    "Amount",
    "Fee",
    "Currency",
    "Description",
    "Date",
  ];

  const rows = transactions.map((tx) => [
    tx.referenceNumber,
    tx.type,
    tx.status,
    tx.amount.toString(),
    tx.fee.toString(),
    tx.currency,
    tx.description ?? "",
    tx.createdAt.toISOString(),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(toCsvValue).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${Date.now()}.csv"`,
    },
  });
}

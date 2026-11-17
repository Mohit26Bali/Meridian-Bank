import type { Metadata } from "next";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { LineChart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser, getInvestmentsForUser } from "@/lib/banking/queries";
import { computeCurrentValue } from "@/lib/banking/investments";
import { formatCurrency } from "@/lib/banking/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { CreateInvestmentDialog } from "@/components/app/create-investment-dialog";
const InvestmentAllocationChart = dynamic(() =>
  import("@/components/app/investment-allocation-chart").then((mod) => mod.InvestmentAllocationChart)
, { loading: () => <Skeleton className="h-64 w-full" /> });
import { InvestmentRow } from "@/components/app/investment-row";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [accounts, investments] = await Promise.all([
    getAccountsForUser(user.id),
    getInvestmentsForUser(user.id),
  ]);

  const withValues = investments.map((inv) => {
    const currentValue =
      inv.status === "ACTIVE"
        ? computeCurrentValue({
            id: inv.id,
            type: inv.type,
            principal: Number(inv.principal),
            expectedReturnRate: Number(inv.expectedReturnRate),
            startDate: inv.startDate,
            maturityDate: inv.maturityDate,
          })
        : Number(inv.currentValue);
    return { ...inv, computedValue: currentValue };
  });

  const activePositions = withValues.filter((inv) => inv.status === "ACTIVE");
  const totalInvested = activePositions.reduce((sum, inv) => sum + Number(inv.principal), 0);
  const totalValue = activePositions.reduce((sum, inv) => sum + inv.computedValue, 0);
  const totalReturns = totalValue - totalInvested;

  const allocationByType = new Map<string, number>();
  for (const inv of activePositions) {
    allocationByType.set(inv.type, (allocationByType.get(inv.type) ?? 0) + inv.computedValue);
  }
  const allocationData = Array.from(allocationByType.entries()).map(([type, value]) => ({
    type,
    value,
  }));

  const accountOptions = accounts.map((a) => ({
    id: a.id,
    accountType: a.accountType,
    accountNumber: a.accountNumber,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
          <p className="text-foreground-secondary mt-1 text-sm">
            Mutual funds, deposits, and stocks — simulated performance.
          </p>
        </div>
        <CreateInvestmentDialog accounts={accountOptions} />
      </div>

      {activePositions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-1 sm:content-center">
              <div>
                <p className="text-foreground-secondary text-xs">Invested</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {formatCurrency(totalInvested)}
                </p>
              </div>
              <div>
                <p className="text-foreground-secondary text-xs">Current value</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {formatCurrency(totalValue)}
                </p>
              </div>
              <div>
                <p className="text-foreground-secondary text-xs">Returns</p>
                <p
                  className={
                    totalReturns >= 0
                      ? "text-success mt-1 text-xl font-semibold tracking-tight"
                      : "text-destructive mt-1 text-xl font-semibold tracking-tight"
                  }
                >
                  {totalReturns >= 0 ? "+" : ""}
                  {formatCurrency(totalReturns)}
                </p>
              </div>
            </div>
            <InvestmentAllocationChart data={allocationData} />
          </CardContent>
        </Card>
      )}

      {investments.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="No investments yet"
          description="Start a mutual fund, fixed deposit, recurring deposit, or stock position above."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {withValues.map((inv) => (
            <InvestmentRow
              key={inv.id}
              id={inv.id}
              type={inv.type}
              status={inv.status}
              principal={inv.principal.toString()}
              currentValue={inv.computedValue}
              startDate={inv.startDate.toISOString()}
              maturityDate={inv.maturityDate?.toISOString() ?? null}
              accounts={accountOptions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

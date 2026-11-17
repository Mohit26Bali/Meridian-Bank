"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency } from "@/lib/banking/format";

const TYPE_LABEL: Record<string, string> = {
  MUTUAL_FUND: "Mutual Fund",
  FIXED_DEPOSIT: "Fixed Deposit",
  RECURRING_DEPOSIT: "Recurring Deposit",
  STOCK: "Stocks",
};

const chartConfig = {
  MUTUAL_FUND: { label: "Mutual Fund", color: "var(--color-invest-mutual-fund)" },
  FIXED_DEPOSIT: { label: "Fixed Deposit", color: "var(--color-invest-fixed-deposit)" },
  RECURRING_DEPOSIT: { label: "Recurring Deposit", color: "var(--color-invest-recurring-deposit)" },
  STOCK: { label: "Stocks", color: "var(--color-invest-stock)" },
} satisfies ChartConfig;

export function InvestmentAllocationChart({
  data,
}: {
  data: { type: string; value: number }[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: TYPE_LABEL[d.type] ?? d.type,
    fill: `var(--color-${d.type})`,
  }));

  return (
    <div className="flex flex-col items-center gap-3">
      <ChartContainer config={chartConfig} className="aspect-square h-56">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="type"
                formatter={(value, name) => [
                  ` ${formatCurrency(Number(value))}`,
                  ` ${TYPE_LABEL[name as string] ?? name}`,
                ]}
              />
            }
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="type"
            innerRadius={56}
            outerRadius={90}
            strokeWidth={2}
            isAnimationActive={false}
          >
            {chartData.map((entry) => (
              <Cell key={entry.type} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
        {chartData.map((entry) => (
          <li key={entry.type} className="flex items-center gap-1.5">
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="text-foreground-secondary">{entry.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

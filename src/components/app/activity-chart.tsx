"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  income: {
    label: "Money in",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export function ActivityChart({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => [
                `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                " money in",
              ]}
            />
          }
        />
        <Bar
          dataKey="income"
          fill="var(--color-income)"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ChartContainer>
  );
}

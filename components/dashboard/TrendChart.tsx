'use client'

import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';
import { FileBarChart } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatCurrency } from '@/lib/utils';

type MonthlyTrend = {
  year: number;
  month: number;
  totalSpent: number;
  categories: { categoryId: string; categoryName: string; spent: number }[];
};

type ChartDataEntry = Record<string, number | string>;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];
const MAX_LEGEND_ITEMS = 5;

type Props = {
  householdId?: Id<"households">;
  isPrivacyMode?: boolean;
};

export function TrendChart({ householdId, isPrivacyMode }: Props) {
  const [range, setRange] = useState(3);

  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months: range,
  });

  const { chartData, chartConfig, topCategoryNames, showOthers } = useMemo(() => {
    if (!trends) return { chartData: [], chartConfig: {}, topCategoryNames: [], showOthers: false };

    // Collect all unique category names across all months, sorted by total spent descending
    const catTotals = new Map<string, number>();
    for (const month of trends) {
      for (const cat of month.categories) {
        catTotals.set(cat.categoryName, (catTotals.get(cat.categoryName) || 0) + cat.spent);
      }
    }
    const sortedCats = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    let topCats: string[];
    let hasOthers = false;
    if (sortedCats.length > MAX_LEGEND_ITEMS) {
      topCats = sortedCats.slice(0, MAX_LEGEND_ITEMS);
      hasOthers = true;
    } else {
      topCats = sortedCats;
    }

    // Build chart config
    const config: Record<string, { label: string; color: string }> = {};
    topCats.forEach((name, i) => {
      config[name] = { label: name, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    if (hasOthers) {
      config['Others'] = { label: 'Others', color: 'var(--muted-foreground)' };
    }

    // Transform to flat chart data entries
    const data: ChartDataEntry[] = trends.map((month: MonthlyTrend) => {
      const entry: ChartDataEntry = { month: MONTH_LABELS[month.month] };
      topCats.forEach(name => {
        const cat = month.categories.find(c => c.categoryName === name);
        entry[name] = cat?.spent ?? 0;
      });
      if (hasOthers) {
        const otherSpent = month.categories
          .filter(c => !topCats.includes(c.categoryName))
          .reduce((sum, c) => sum + c.spent, 0);
        entry['Others'] = otherSpent;
      }
      return entry;
    });

    return { chartData: data, chartConfig: config, topCategoryNames: topCats, showOthers: hasOthers };
  }, [trends]);

  if (trends === undefined) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trends.length === 0 || chartData.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] flex items-center justify-center">
            <EmptyState icon={FileBarChart} description="Spending trend will appear here once you have transactions." />
          </div>
        </CardContent>
      </Card>
    );
  }

  const barNames = showOthers ? [...topCategoryNames, 'Others'] : topCategoryNames;
  const bars = barNames.map((name, i) => (
    <Bar
      key={name}
      dataKey={name}
      stackId="spending"
      fill={chartConfig[name]?.color}
      radius={i === barNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
    />
  ));

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Monthly Trend
        </CardTitle>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setRange(m)}
              className={cn(
                'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors',
                range === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m}mo
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[240px] w-full">
          <BarChart data={chartData} barCategoryGap="12%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
              tickFormatter={(value: number) => {
                if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
                if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                return value.toString();
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{name}:</span>
                      <span>{formatCurrency(value as number, { isPrivacyMode })}</span>
                    </div>
                  )}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            />
            {bars}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

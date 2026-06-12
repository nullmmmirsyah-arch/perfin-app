# TrendChart — Desktop Planning View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monthly spending trend visualization (stacked bar chart) on desktop dashboard.

**Architecture:** New Convex query `getMonthlyTrends` aggregates transactions by fiscal month + category. New `TrendChart` component renders a stacked bar chart using shadcn/ui chart (recharts). Desktop layout updated to place it in right grid column.

**Tech Stack:** Next.js 16, Convex, recharts + shadcn/ui chart, date-fns

**Spec:** `docs/superpowers/specs/2025-06-12-trendchart-phase3.md`

---

## File Structure

```
Modify: convex/dashboard.ts                — add getMonthlyTrends query
Create: components/dashboard/TrendChart.tsx  — stacked bar chart component
Modify: app/dashboard/page.tsx             — add TrendChart to desktop grid
```

---

### Task 1: Convex Query `getMonthlyTrends`

**Files:**
- Modify: `convex/dashboard.ts` (add after `getDashboardSummary`)
- Reference: `lib/finance-utils.ts` — `getFiscalDate`, `getFiscalMonthRange`, `getFiscalDateDetails`

- [ ] **Step 1: Add the `getMonthlyTrends` query definition**

Add after `getDashboardSummary` in `convex/dashboard.ts`:

```ts
export const getMonthlyTrends = query({
  args: { householdId: v.optional(v.id("households")), months: v.optional(v.number()) },
  handler: async (ctx, { householdId, months = 3 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    const household = await getHousehold(ctx, householdId, userId);
    const startDay = household?.budgetStartDay || 1;

    let allTransactions;
    if (householdId) {
      allTransactions = await ctx.db.query("transactions").withIndex("by_householdId", q => q.eq("householdId", householdId)).collect();
    } else {
      allTransactions = await ctx.db.query("transactions").withIndex("by_userId", (q) => q.eq("userId", userId)).collect();
    }

    // Determine fiscal month range (last N fiscal months)
    const now = new Date();
    const currentFiscal = getFiscalDate(now, startDay);
    const currentYear = currentFiscal.getFullYear();
    const currentMonth = currentFiscal.getMonth();

    // Collect transactions in the last N fiscal months
    const monthGroups = new Map<string, { year: number; month: number; categories: Map<string, number> }>();
    const categoryIds = new Set<string>();

    for (let i = 0; i < months; i++) {
      let targetYear = currentYear;
      let targetMonth = currentMonth - i;
      if (targetMonth < 0) { targetMonth += 12; targetYear -= 1; }
      const key = `${targetYear}-${targetMonth}`;
      monthGroups.set(key, { year: targetYear, month: targetMonth, categories: new Map() });
    }

    for (const tx of allTransactions) {
      if (tx.type === 'transfer' || tx.type === 'income') continue;
      const txFiscal = getFiscalDate(new Date(tx.date), startDay);
      const txYear = txFiscal.getFullYear();
      const txMonth = txFiscal.getMonth();
      const key = `${txYear}-${txMonth}`;

      if (monthGroups.has(key)) {
        const group = monthGroups.get(key)!;
        const catId = tx.categoryId || '__uncategorized__';
        categoryIds.add(catId);
        const amt = parseFloat(tx.amount.replace(/,/g, '') || '0');
        group.categories.set(catId, (group.categories.get(catId) || 0) + amt);

        // Handle splits
        if (tx.splits) {
          for (const split of tx.splits) {
            const splitCatId = split.categoryId || '__uncategorized__';
            categoryIds.add(splitCatId);
            const splitAmt = parseFloat(split.amount.replace(/,/g, '') || '0');
            group.categories.set(splitCatId, (group.categories.get(splitCatId) || 0) + splitAmt);
          }
        }
      }
    }

    // Resolve category names
    const categoryNameMap = new Map<string, string>();
    for (const catId of categoryIds) {
      if (catId === '__uncategorized__') {
        categoryNameMap.set(catId, 'Uncategorized');
        continue;
      }
      const cat = await ctx.db.get(catId as any);
      categoryNameMap.set(catId, cat?.name || 'Unknown');
    }

    // Build output
    const result: Array<{ year: number; month: number; totalSpent: number; categories: Array<{ categoryId: string; categoryName: string; spent: number }> }> = [];

    // Iterate in chronological order (oldest first)
    const sortedKeys = [...monthGroups.keys()].sort();
    for (const key of sortedKeys) {
      const group = monthGroups.get(key)!;
      const totalSpent = [...group.categories.values()].reduce((a, b) => a + b, 0);
      const categories = [...group.categories.entries()]
        .map(([catId, spent]) => ({
          categoryId: catId,
          categoryName: categoryNameMap.get(catId) || 'Unknown',
          spent,
        }))
        .sort((a, b) => b.spent - a.spent);

      result.push({ year: group.year, month: group.month, totalSpent, categories });
    }

    return result;
  },
});
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Compiled successfully, no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add convex/dashboard.ts
git commit -m "feat: add getMonthlyTrends Convex query for trend chart"
```

---

### Task 2: TrendChart Component

**Files:**
- Create: `components/dashboard/TrendChart.tsx`
- Reference: `components/ui/chart.tsx` for shadcn wrapper

- [ ] **Step 1: Create TrendChart component**

```tsx
'use client'

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';
import { useMemo } from 'react';
import { formatCurrency, cn } from '@/lib/utils';

type MonthlyTrend = {
  year: number;
  month: number;
  totalSpent: number;
  categories: { categoryId: string; categoryName: string; spent: number }[];
};

type ChartDataEntry = Record<string, number | string>;

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];
const MAX_LEGEND_ITEMS = 5;

type Props = {
  householdId?: string;
};

export function TrendChart({ householdId }: Props) {
  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
  });

  const { chartData, chartConfig, allCategories } = useMemo(() => {
    if (!trends) return { chartData: [], chartConfig: {}, allCategories: [] };

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

    let topCategories: string[];
    let hasOthers = false;
    if (sortedCats.length > MAX_LEGEND_ITEMS) {
      topCategories = sortedCats.slice(0, MAX_LEGEND_ITEMS);
      hasOthers = true;
    } else {
      topCategories = sortedCats;
    }

    // Build chart config
    const config: Record<string, { label: string; color: string }> = {};
    topCategories.forEach((name, i) => {
      config[name] = { label: name, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    if (hasOthers) {
      config['Others'] = { label: 'Others', color: 'hsl(var(--muted-foreground))' };
    }

    // Transform to flat chart data entries
    const data: ChartDataEntry[] = trends.map((month: MonthlyTrend) => {
      const entry: ChartDataEntry = { month: MONTH_LABELS[month.month] };
      topCategories.forEach(name => {
        const cat = month.categories.find(c => c.categoryName === name);
        entry[name] = cat?.spent ?? 0;
      });
      if (hasOthers) {
        const otherSpent = month.categories
          .filter(c => !topCategories.includes(c.categoryName))
          .reduce((sum, c) => sum + c.spent, 0);
        entry['Others'] = otherSpent;
      }
      return entry;
    });

    return { chartData: data, chartConfig: config, allCategories: sortedCats };
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
            <p className="text-xs text-muted-foreground italic">
              Spending trend will appear here once you have transactions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Monthly Trend
        </CardTitle>
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
                  formatter={(value: number, name: string) => (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{name}:</span>
                      <span>{formatCurrency(value)}</span>
                    </div>
                  )}
                />
              }
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            />
            {allCategories.length <= MAX_LEGEND_ITEMS
              ? allCategories.map((name) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="spending"
                    fill={chartConfig[name]?.color}
                    radius={[0, 0, 0, 0]}
                  />
                ))
              : [
                  ...allCategories.slice(0, MAX_LEGEND_ITEMS).map((name) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="spending"
                      fill={chartConfig[name]?.color}
                      radius={[0, 0, 0, 0]}
                    />
                  )),
                  <Bar
                    key="Others"
                    dataKey="Others"
                    stackId="spending"
                    fill={chartConfig['Others']?.color}
                    radius={[0, 0, 0, 0]}
                  />,
                ]}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/TrendChart.tsx
git commit -m "feat: add TrendChart stacked bar chart component"
```

---

### Task 3: Desktop Layout Integration

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Import TrendChart**

Add to imports in `app/dashboard/page.tsx`:

```tsx
import { TrendChart } from '@/components/dashboard/TrendChart';
```

- [ ] **Step 2: Add TrendChart to desktop grid**

Replace the current desktop section (`hidden md:grid`):

```tsx
{/* Desktop: Planning Layout */}
<div className="hidden md:grid gap-6 md:grid-cols-2 mb-8">
  {summary === undefined ? (
    <>
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
    </>
  ) : (
    <>
      <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
      <TrendChart householdId={householdId ?? undefined} />
    </>
  )}
</div>
```

Also remove `WealthCard` import if it's no longer used in the desktop section. Keep the component file — it's still used by MobileDashboardTabs.

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add TrendChart to desktop dashboard layout"
```

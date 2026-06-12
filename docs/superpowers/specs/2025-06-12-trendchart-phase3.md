# Phase 3: TrendChart — Desktop Planning View

## Goal
Add monthly spending trend visualization on the desktop dashboard, enabling users to review spending patterns over the last 3 months.

## Architecture

```
TrendChart component ─── getMonthlyTrends (Convex query)
     │                           │
     │                    filters allTransactions
     │                    groups by fiscal month + category
     │
  recharts (shadcn/ui chart wrapper)
  StackedBarChart
```

## Convex Query: `getMonthlyTrends`

- **File:** `convex/dashboard.ts` (new exported query)
- **Input:** `{ householdId?: Id<"households">, months?: number }` (default 3)
- **Process:**
  1. Auth check
  2. Fetch all transactions
  3. Compute current fiscal month using `getFiscalDate`
  4. Filter to last N fiscal months (current inclusive)
  5. Group by `{ fiscalYear, fiscalMonth }` then by `categoryId`
  6. Resolve category names
- **Output:**
```ts
type MonthlyTrend = {
  year: number;
  month: number;     // 0-indexed fiscal month
  totalSpent: number;
  categories: {
    categoryId: string;
    categoryName: string;
    spent: number;
  }[];
};
```

## Component: `TrendChart`

- **File:** `components/dashboard/TrendChart.tsx` (new)
- **Tech:** shadcn/ui `chart.tsx` wrapper + recharts `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`
- **Data source:** `api.dashboard.getMonthlyTrends`
- **Chart type:** Stacked bar chart
  - X-axis: 3 months (formatted as "Jun", "May", "Apr")
  - Y-axis: total spending (rupiah, abbreviated)
  - Stacked by category
- **Colors:** Use CSS chart variables (`--chart-1` through `--chart-5`) + muted gray for "Others"
- **Tooltip:** On hover shows per-category breakdown + total for that month
- **Legend:** Top 5 categories by total spending across 3 months; remaining merged as "Others"
- **Empty state:** If no transactions or no budgets, show "Spending trend will appear here once you have transactions"
- **Height:** 240px (fixed, responsive width)

## Desktop Layout Changes

- **File:** `app/dashboard/page.tsx`
- Add `TrendChart` to the right column of the desktop grid (`hidden md:grid`)
- Current desktop: 2-col grid with `DailyOperationsCard` + `WealthCard`
- New layout:
  ```
  Desktop (md:grid-cols-2):
  ├── Left:  DailyOperationsCard
  ├── Right: TrendChart
  └── Bottom: RecentTransactions (full width, unchanged)
  ```
- `WealthCard` stays in mobile tab; may be added back to desktop later

## Data Flow

```
Transaction created (mutation)
  → Convex auto-updates useQuery
  → getMonthlyTrends re-runs
  → TrendChart re-renders with latest data
```

No polling, no refresh button — Convex reactivity handles it.

## Notes

- Fiscal month alignment: Use `getFiscalDate` and `getFiscalMonthRange` from `lib/finance-utils.ts`
- Category colors: Use `category.color` if available, fallback to chart color array
- "Others" grouping: Only for legend; tooltip still shows all categories

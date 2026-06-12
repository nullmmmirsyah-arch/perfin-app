# Phase 3 Desktop Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three desktop planning tools: MonthlyComparison, WhatIfSimulator, BudgetQuickEdit.

**Architecture:** All three components use existing data (getMonthlyTrends, budgetBreakdown, upsertBudget). No new backend queries or mutations needed. Each component is independent, client-side only.

**Tech Stack:** Next.js 16, shadcn/ui, recharts (slider), sonner (toast), date-fns

**Spec:** `docs/superpowers/specs/2025-06-12-phase3-desktop-planning.md`

---

## File Structure

```
Create: components/dashboard/MonthlyComparison.tsx
Create: components/dashboard/WhatIfSimulator.tsx
Create: components/dashboard/BudgetQuickEdit.tsx
Modify: app/dashboard/page.tsx
```

---

### Task 1: MonthlyComparison Component

**Files:**
- Create: `components/dashboard/MonthlyComparison.tsx`

- [ ] **Step 1: Create MonthlyComparison component**

```tsx
'use client'

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';

type MonthlyTrend = {
  year: number;
  month: number;
  totalSpent: number;
  categories: { categoryId: string; categoryName: string; spent: number }[];
};

type Props = {
  householdId?: Id<"households">;
  isPrivacyMode?: boolean;
};

export function MonthlyComparison({ householdId, isPrivacyMode }: Props) {
  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months: 2,
  });

  if (trends === undefined) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trends.length < 2) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              Comparison will appear once you have at least 2 months of data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const thisMonth = trends[0];
  const lastMonth = trends[1];
  const diff = thisMonth.totalSpent - lastMonth.totalSpent;
  const pctChange = lastMonth.totalSpent > 0
    ? Math.round((diff / lastMonth.totalSpent) * 100)
    : 0;
  const isDecrease = diff < 0;

  // Find top 3 categories by absolute change
  const categoryChanges: { name: string; thisAmt: number; lastAmt: number; diff: number; pct: number }[] = [];
  const allCatNames = new Set<string>();
  for (const m of trends) {
    for (const c of m.categories) allCatNames.add(c.categoryName);
  }
  for (const name of allCatNames) {
    const thisAmt = thisMonth.categories.find(c => c.categoryName === name)?.spent ?? 0;
    const lastAmt = lastMonth.categories.find(c => c.categoryName === name)?.spent ?? 0;
    const catDiff = thisAmt - lastAmt;
    const catPct = lastAmt > 0 ? Math.round((catDiff / lastAmt) * 100) : 0;
    categoryChanges.push({ name, thisAmt, lastAmt, diff: catDiff, pct: catPct });
  }
  categoryChanges.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const topChanges = categoryChanges.slice(0, 3);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <div className={cn(
            'flex items-center gap-1 text-2xl font-bold',
            isDecrease ? 'text-success' : 'text-destructive'
          )}>
            {isDecrease ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            {Math.abs(pctChange)}%
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          {formatCurrency(thisMonth.totalSpent, { isPrivacyMode })} this month &middot;{' '}
          {formatCurrency(lastMonth.totalSpent, { isPrivacyMode })} last month
        </p>

        {topChanges.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-semibold mb-2">
              Biggest changes
            </p>
            <div className="space-y-2">
              {topChanges.map(cat => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <span className="truncate">{cat.name}</span>
                  <span className={cn(
                    'tabular-nums shrink-0 ml-2',
                    cat.diff > 0 ? 'text-destructive' : cat.diff < 0 ? 'text-success' : 'text-muted-foreground'
                  )}>
                    {cat.diff > 0 ? '↑' : cat.diff < 0 ? '↓' : '→'} {Math.abs(cat.pct)}%
                    <span className="text-muted-foreground ml-1">
                      {cat.diff > 0 ? '+' : ''}{formatCurrency(cat.diff, { isPrivacyMode })}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

Note: Add `import { cn } from '@/lib/utils';` at the top.

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/MonthlyComparison.tsx
git commit -m "feat: add MonthlyComparison card component"
```

---

### Task 2: WhatIfSimulator Component

**Files:**
- Create: `components/dashboard/WhatIfSimulator.tsx`

- [ ] **Step 1: Create WhatIfSimulator component**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { formatCurrency, cn } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { RotateCcw } from 'lucide-react';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function WhatIfSimulator({ summary, isPrivacyMode }: Props) {
  const items = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
  );

  const [values, setValues] = useState<Record<string, number>>({});

  // Initialize values from summary when it changes
  useMemo(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit;
    }
    setValues(initial);
  }, [summary]);

  const handleSliderChange = useCallback((categoryId: string, newValue: number) => {
    setValues(prev => ({ ...prev, [categoryId]: newValue }));
  }, []);

  const handleReset = useCallback(() => {
    const initial: Record<string, number> = {};
    for (const item of items) {
      initial[item.categoryId] = item.limit;
    }
    setValues(initial);
  }, [items]);

  const { originalTotal, adjustedTotal, totalDiff, dailyAllowance } = useMemo(() => {
    const origTotal = items.reduce((sum, item) => sum + item.limit, 0);
    const adjTotal = Object.entries(values).reduce((sum, [id, val]) => sum + val, 0);
    const diff = adjTotal - origTotal;
    const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
    const daily = daysRemaining > 0 ? Math.max(0, (summary?.remainingBudget || 0) + diff) / daysRemaining : 0;
    return { originalTotal: origTotal, adjustedTotal: adjTotal, totalDiff: diff, dailyAllowance: daily };
  }, [values, items, summary]);

  if (!summary || items.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">What If...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              Set up budgets to explore what-if scenarios.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">What If...</CardTitle>
        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-[200px] overflow-y-auto">
          {items.map((item: BudgetBreakdownItem) => {
            const currentVal = values[item.categoryId] ?? item.limit;
            const min = Math.round(item.limit * 0.5 / 10000) * 10000;
            const max = Math.round(item.limit * 1.5 / 10000) * 10000;
            return (
              <div key={item.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate">{item.categoryName}</span>
                  <span className="tabular-nums font-medium shrink-0 ml-2">
                    {formatCurrency(currentVal, { isPrivacyMode })}
                  </span>
                </div>
                <input
                  type="range"
                  value={currentVal}
                  min={Math.max(0, min)}
                  max={max}
                  step={10000}
                  onChange={(e) => handleSliderChange(item.categoryId, Number(e.target.value))}
                  className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/50 pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total budget</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(adjustedTotal, { isPrivacyMode })}
              {totalDiff !== 0 && (
                <span className={cn('ml-1', totalDiff < 0 ? 'text-success' : 'text-destructive')}>
                  ({totalDiff < 0 ? '' : '+'}{formatCurrency(totalDiff, { isPrivacyMode })})
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Daily allowance</span>
            <span className="tabular-nums font-medium">
              {formatCurrency(dailyAllowance, { isPrivacyMode })}/day
            </span>
          </div>
        </div>
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
git add components/dashboard/WhatIfSimulator.tsx
git commit -m "feat: add WhatIfSimulator with slider-based budget scenarios"
```

---

### Task 3: BudgetQuickEdit Component

**Files:**
- Create: `components/dashboard/BudgetQuickEdit.tsx`

- [ ] **Step 1: Create BudgetQuickEdit component**

```tsx
'use client'

import { useState, useMemo, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, parseAmount } from '@/lib/utils';
import { getFiscalDate } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  budgetStartDay?: number;
  isPrivacyMode?: boolean;
};

export function BudgetQuickEdit({ summary, budgetStartDay, isPrivacyMode }: Props) {
  const upsertBudget = useMutation(api.budgets.upsertBudget);

  const items = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
  );

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(() => {
    return Object.entries(edits).some(([id, val]) => {
      const item = items.find(i => i.categoryId === id);
      if (!item) return false;
      const parsed = parseAmount(val);
      return parsed !== item.limit;
    });
  }, [edits, items]);

  const handleChange = useCallback((categoryId: string, value: string) => {
    setEdits(prev => ({ ...prev, [categoryId]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    const fiscalNow = getFiscalDate(new Date(), budgetStartDay);
    setSaving(true);
    try {
      const changes = Object.entries(edits).filter(([id, val]) => {
        const item = items.find(i => i.categoryId === id);
        if (!item) return false;
        return parseAmount(val) !== item.limit;
      });

      for (const [categoryId, val] of changes) {
        await upsertBudget({
          categoryId: categoryId as any,
          amount: val,
          year: fiscalNow.getFullYear(),
          month: fiscalNow.getMonth(),
        });
      }
      toast.success('Budget limits updated');
      setEdits({});
    } catch {
      toast.error('Failed to update budgets');
    } finally {
      setSaving(false);
    }
  }, [edits, items, upsertBudget, budgetStartDay]);

  if (!summary || items.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Budget Quick Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground italic">
              No budgets to edit.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Budget Quick Edit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {items.map((item: BudgetBreakdownItem) => {
            const editVal = edits[item.categoryId] ?? '';
            const displayVal = editVal || formatCurrency(item.limit, { isPrivacyMode });
            return (
              <div key={item.categoryId} className="flex items-center gap-3">
                <span className="text-xs w-24 truncate shrink-0">{item.categoryName}</span>
                <span className="text-xs text-muted-foreground w-20 shrink-0">
                  {formatCurrency(item.limit, { isPrivacyMode })}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={String(item.limit)}
                  value={editVal}
                  onChange={(e) => handleChange(item.categoryId, e.target.value)}
                  className="h-8 text-xs text-right flex-1"
                />
              </div>
            );
          })}
        </div>

        <Button
          size="sm"
          className="w-full h-8 text-xs"
          disabled={!hasChanges || saving}
          onClick={handleSave}
        >
          {saving ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
          ) : (
            'Save Changes'
          )}
        </Button>
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
git add components/dashboard/BudgetQuickEdit.tsx
git commit -m "feat: add BudgetQuickEdit inline budget limit editor"
```

---

### Task 4: Desktop Layout Update

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { MonthlyComparison } from '@/components/dashboard/MonthlyComparison';
import { WhatIfSimulator } from '@/components/dashboard/WhatIfSimulator';
import { BudgetQuickEdit } from '@/components/dashboard/BudgetQuickEdit';
```

- [ ] **Step 2: Update desktop grid**

Replace the current desktop section with:

```tsx
{/* Desktop: Planning Layout */}
<div className="hidden md:grid gap-6 mb-8">
  {/* Row 1: Daily Ops + TrendChart */}
  <div className="grid md:grid-cols-2 gap-6">
    {summary === undefined ? (
      <>
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </>
    ) : (
      <>
        <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
        <TrendChart householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
      </>
    )}
  </div>

  {/* Row 2: MonthlyComparison + WhatIfSimulator */}
  <div className="grid md:grid-cols-2 gap-6">
    <MonthlyComparison householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
    <WhatIfSimulator summary={summary} isPrivacyMode={isPrivacyMode} />
  </div>

  {/* Row 3: BudgetQuickEdit + (empty for now) */}
  <div className="grid md:grid-cols-2 gap-6">
    <BudgetQuickEdit summary={summary} budgetStartDay={budgetStartDay} isPrivacyMode={isPrivacyMode} />
    <div /> {/* placeholder for future component */}
  </div>
</div>
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add MonthlyComparison, WhatIfSimulator, BudgetQuickEdit to desktop layout"
```

# Phase 2: Mobile Daily View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mobile carousel with vertical scrollable daily decision view composed of new independent components.

**Architecture:** Each dashboard section is an independent component receiving `summary` (from `getDashboardSummary`) and `isPrivacyMode` as props. Mobile layout in `page.tsx` switches from carousel to vertical stack. Desktop layout unchanged. No new Convex queries needed - all data filtered client-side from existing `summary` object.

**Tech Stack:** Next.js 14 App Router, shadcn/ui (Card, Badge, Tabs, Progress), Tailwind CSS, Convex reactive queries

---

### File Structure

```
components/dashboard/
├── DailyOperationsCard.tsx    (unchanged - still used on desktop)
├── WealthCard.tsx             (unchanged - still used on desktop)
├── DailyGuidance.tsx          [NEW] overall status + daily recommendation
├── BudgetSummary.tsx          [NEW] remaining budget + progress + days remaining
├── TodaySpending.tsx          [NEW] today's transactions + allowance used
├── BudgetAttentionList.tsx    [NEW] danger/warning budget items + collapsed safe
├── BalanceSummary.tsx         [NEW] aggregated balance with account drill-down
├── LentSummary.tsx            [NEW] total receivables + pending list
├── GoalSummary.tsx            [NEW] goals progress bars (from WealthCard Goals tab)
├── MobileDashboardTabs.tsx    [NEW] tabbed container: Balance | Lent | Goals

app/dashboard/page.tsx         [MODIFY] mobile section: carousel → vertical stack
```

### Data Shape (from `api.dashboard.getDashboardSummary`)

```typescript
type DashboardSummary = {
  liquidCash: number;
  totalSavingsOnly: number;
  totalAssetsOnly: number;
  remainingBudget: number;
  unassignedCash: number;
  cashAccounts: { name: string; balance: number; allocations?: { name: string; amount: number }[]; bankBalance?: number }[];
  savingAccounts: { name: string; balance: number }[];
  assetAccounts: { name: string; balance: number }[];
  budgetBreakdown: BudgetBreakdownItem[];
  recentTransactions: TransactionWithDetails[];
  totalReceivables: number;
  pendingReceivables: any[];
  totalExpenseObligations: number;
  totalSavingObligations: number;
  totalDebtCovered: number;
};
```

### Status Aggregation Rule (for DailyGuidance)

From `budgetBreakdown`, compute per-item pace via `calculateBudgetPace(spent, limit, ...)`:
- Any `danger` → overall status "Slow down"
- Any `warning` (but no `danger`) → overall status "Spending faster"
- All `safe` → overall status "On track"

---

### Task 1: Create DailyGuidance

**Files:**
- Create: `components/dashboard/DailyGuidance.tsx`

- [ ] **Step 1: Define component props and status computation**

```typescript
'use client'

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { calculateBudgetPace, calculateFiscalDaysRemaining } from '@/lib/finance-utils';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

type OverallStatus = 'on_track' | 'spending_faster' | 'slow_down';

function computeOverallStatus(breakdown: BudgetBreakdownItem[], budgetStartDay?: number): OverallStatus {
  if (!breakdown || breakdown.length === 0) return 'on_track';

  const year = new Date().getFullYear();
  const month = new Date().getMonth();

  let hasWarning = false;
  for (const item of breakdown) {
    if (item.enablePacing === false) continue;
    const pace = calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay);
    if (pace.status === 'danger') return 'slow_down';
    if (pace.status === 'warning') hasWarning = true;
  }
  return hasWarning ? 'spending_faster' : 'on_track';
}

function computeDailyAllowance(remainingBudget: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return Math.max(0, remainingBudget / daysRemaining);
}
```

- [ ] **Step 2: Build the component UI**

```typescript
export function DailyGuidance({ summary, isPrivacyMode }: Props) {
  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
  const fiscalDaysElapsed = 30 - daysRemaining + 1;
  const totalFiscalDays = 30;
  const hasBudgets = (summary?.budgetBreakdown || []).length > 0;
  const status = computeOverallStatus(summary?.budgetBreakdown || [], summary?.budgetStartDay);
  const dailyAllowance = computeDailyAllowance(summary?.remainingBudget || 0, daysRemaining);

  const statusConfig = {
    on_track: { label: 'On Track', class: 'bg-success/10 text-success border-success/20' },
    spending_faster: { label: 'Spending Faster', class: 'bg-warning/10 text-warning border-warning/20' },
    slow_down: { label: 'Slow Down', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  } as const;

  const config = statusConfig[status];

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold mb-1">
              Day {fiscalDaysElapsed} of {totalFiscalDays}
            </p>
            <h2 className="text-lg font-bold tracking-tight">Daily Guidance</h2>
          </div>
          {hasBudgets && (
            <Badge variant="outline" className={cn('text-xs font-semibold px-3 py-1', config.class)}>
              {config.label}
            </Badge>
          )}
        </div>
        {hasBudgets ? (
          <div>
            <p className="text-sm text-muted-foreground">
              Spend up to{' '}
              <span className="font-bold text-foreground">
                {formatCurrency(dailyAllowance, { isPrivacyMode })}
              </span>{' '}
              today
            </p>
            {daysRemaining > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining this period
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set up your first budget to get daily guidance.{' '}
            <Link href="/budgets" className="text-primary underline underline-offset-2 font-medium">
              Go to Budgets
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add DailyGuidance component for mobile dashboard"
```

---

### Task 2: Create BudgetSummary

**Files:**
- Create: `components/dashboard/BudgetSummary.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: { limit: number; spent: number }[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function BudgetSummary({ summary, isPrivacyMode }: Props) {
  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
  const totalBudget = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.limit, 0) || 0;
  const totalSpent = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.spent, 0) || 0;
  const remaining = summary?.remainingBudget || 0;
  const percentUsed = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Budget Left
          </p>
          <p className="text-xs text-muted-foreground">
            {daysRemaining > 0 ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left` : 'Final day'}
          </p>
        </div>
        <p className="text-2xl font-bold mb-3">
          {formatCurrency(remaining, { isPrivacyMode })}
        </p>
        <Progress value={percentUsed} className="h-2" />
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-muted-foreground">
            {formatCurrency(totalSpent, { isPrivacyMode })} spent
          </span>
          <span className="text-[11px] text-muted-foreground">
            of {formatCurrency(totalBudget, { isPrivacyMode })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add BudgetSummary component for mobile dashboard"
```

---

### Task 3: Create TodaySpending

**Files:**
- Create: `components/dashboard/TodaySpending.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, cn } from '@/lib/utils';
import { calculateFiscalDaysRemaining } from '@/lib/finance-utils';
import { TransactionWithDetails } from '@/components/transactions/types';

type SummaryData = {
  remainingBudget: number;
  budgetBreakdown: { limit: number; spent: number }[];
  recentTransactions: TransactionWithDetails[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function TodaySpending({ summary, isPrivacyMode }: Props) {
  const todayTxns = (summary?.recentTransactions || []).filter(
    (tx: TransactionWithDetails) => isToday(tx.date)
  );

  const todaySpent = todayTxns.reduce(
    (acc: number, tx: TransactionWithDetails) => acc + (tx.amount || 0),
    0
  );

  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay);
  const dailyAllowance = daysRemaining > 0
    ? Math.max(0, (summary?.remainingBudget || 0) / daysRemaining)
    : 0;

  // Total daily budget = current daily allowance + today's spending
  const totalDailyBudget = dailyAllowance + todaySpent;
  const percentUsed = totalDailyBudget > 0
    ? Math.min(100, (todaySpent / totalDailyBudget) * 100)
    : 0;

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Today&apos;s Spending
          </p>
          <p className="text-sm font-semibold">
            {formatCurrency(todaySpent, { isPrivacyMode })}
            <span className="text-xs text-muted-foreground font-normal">
              {' '}/ {formatCurrency(totalDailyBudget, { isPrivacyMode })}
            </span>
          </p>
        </div>

        <Progress value={percentUsed} className="h-2 mb-3" />

        {todayTxns.length > 0 ? (
          <div className="space-y-2 max-h-[160px] overflow-y-auto">
            {todayTxns.slice(0, 5).map((tx: TransactionWithDetails) => (
              <div key={tx._id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full shrink-0',
                    tx.type === 'expense' ? 'bg-destructive' : 'bg-success'
                  )} />
                  <span className="text-xs truncate">{tx.description || tx.categoryName}</span>
                </div>
                <span className={cn(
                  'text-xs font-medium tabular-nums shrink-0 ml-2',
                  tx.type === 'expense' ? 'text-destructive' : 'text-success'
                )}>
                  {tx.type === 'expense' ? '-' : '+'}
                  {formatCurrency(tx.amount, { isPrivacyMode })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No spending yet today. You have{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(dailyAllowance, { isPrivacyMode })}
            </span>{' '}
            to spend.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add TodaySpending component for mobile dashboard"
```

---

### Task 4: Create BudgetAttentionList

**Files:**
- Create: `components/dashboard/BudgetAttentionList.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { calculateBudgetPace } from '@/lib/finance-utils';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
  budgetStartDay?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

function getPaceInfo(item: BudgetBreakdownItem, budgetStartDay?: number) {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  return calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay);
}

function getStatusBadge(status: 'safe' | 'warning' | 'danger') {
  switch (status) {
    case 'danger': return { label: 'Too Fast', class: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'warning': return { label: 'Watch', class: 'bg-warning/10 text-warning border-warning/20' };
    case 'safe': return { label: 'On Track', class: 'bg-success/10 text-success border-success/20' };
  }
}

export function BudgetAttentionList({ summary, isPrivacyMode }: Props) {
  const [showSafe, setShowSafe] = useState(false);

  const items = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.enablePacing !== false && item.limit > 0
  );

  const pacedItems = items.map((item: BudgetBreakdownItem) => ({
    ...item,
    pace: getPaceInfo(item, summary?.budgetStartDay),
  }));

  const dangerItems = pacedItems.filter((item) => item.pace.status === 'danger');
  const warningItems = pacedItems.filter((item) => item.pace.status === 'warning');
  const safeItems = pacedItems.filter((item) => item.pace.status === 'safe');

  const attentionItems = [...dangerItems, ...warningItems];

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Budget Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {attentionItems.length === 0 && safeItems.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No budgets set.{' '}
            <Link href="/budgets" className="text-primary underline underline-offset-2 font-medium">
              Set up your first budget
            </Link>
          </p>
        )}

        {attentionItems.length === 0 && safeItems.length > 0 && (
          <p className="text-xs text-success">All budgets are on track!</p>
        )}

        {attentionItems.map((item) => {
          const badge = getStatusBadge(item.pace.status);
          return (
            <div key={item.categoryId} className="flex items-center justify-between py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.categoryName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatCurrency(item.remaining, { isPrivacyMode })} left
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', badge.class)}>
                  {badge.label}
                </Badge>
                {item.pace.status !== 'safe' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatCurrency(item.pace.dailyLimit, { isPrivacyMode })}/day
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {safeItems.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-8"
            onClick={() => setShowSafe(!showSafe)}
          >
            {showSafe ? (
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            {showSafe
              ? 'Hide on track budgets'
              : `${safeItems.length} other budget${safeItems.length > 1 ? 's' : ''} on track`}
          </Button>
        )}

        {showSafe && safeItems.map((item) => {
          const badge = getStatusBadge('safe');
          return (
            <div key={item.categoryId} className="flex items-center justify-between py-1">
              <p className="text-xs truncate">{item.categoryName}</p>
              <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', badge.class)}>
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add BudgetAttentionList component for mobile dashboard"
```

---

### Task 5: Create BalanceSummary

**Files:**
- Create: `components/dashboard/BalanceSummary.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';

type CashAccount = {
  name: string;
  balance: number;
  allocations?: { name: string; amount: number }[];
  bankBalance?: number;
};

type SummaryData = {
  liquidCash: number;
  cashAccounts: CashAccount[];
  unassignedCash?: number;
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function BalanceSummary({ summary, isPrivacyMode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const accounts = summary?.cashAccounts || [];
  const totalBalance = summary?.liquidCash || 0;

  const hasNoAccounts = accounts.length === 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Balance
        </p>
        {hasNoAccounts ? (
          <p className="text-2xl font-bold text-muted-foreground">
            {formatCurrency(0, { isPrivacyMode })}
          </p>
        ) : (
          <p className="text-2xl font-bold">
            {formatCurrency(totalBalance, { isPrivacyMode })}
          </p>
        )}
      </div>

      {hasNoAccounts ? (
        <p className="text-xs text-muted-foreground">
          Add an account to track your balance.{' '}
          <Link href="/accounts" className="text-primary underline underline-offset-2 font-medium">
            Go to Accounts
          </Link>
        </p>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground h-7 justify-start px-0 hover:bg-transparent"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            {accounts.length} account{accounts.length > 1 ? 's' : ''}
          </Button>

          {expanded && (
            <div className="space-y-2">
              {accounts.map((account, i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <span className="text-xs truncate">{account.name}</span>
                  <span className="text-xs font-medium tabular-nums">
                    {formatCurrency(account.balance, { isPrivacyMode })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add BalanceSummary component for mobile dashboard"
```

---

### Task 6: Create LentSummary

**Files:**
- Create: `components/dashboard/LentSummary.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import { formatCurrency } from '@/lib/utils';

type PendingReceivable = {
  _id: string;
  amount: string;
  amountPaid: string;
  owedBy?: string;
  description?: string;
};

type SummaryData = {
  totalReceivables: number;
  pendingReceivables: PendingReceivable[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function LentSummary({ summary, isPrivacyMode }: Props) {
  const receivables: PendingReceivable[] = summary?.pendingReceivables || [];
  const totalOwed = receivables.reduce((acc, r) => {
    const amount = parseFloat(r.amount) || 0;
    const paid = parseFloat(r.amountPaid) || 0;
    return acc + (amount - paid);
  }, 0);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Lent
        </p>
        <p className="text-2xl font-bold">
          {formatCurrency(totalOwed, { isPrivacyMode })}
        </p>
      </div>

      {receivables.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No active receivables</p>
      )}

      {receivables.length > 0 && (
        <div className="space-y-2 max-h-[160px] overflow-y-auto">
          {receivables.map((r) => {
            const amount = parseFloat(r.amount) || 0;
            const paid = parseFloat(r.amountPaid) || 0;
            const remaining = amount - paid;
            return (
              <div key={r._id} className="flex items-center justify-between py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{r.owedBy || 'Unknown'}</p>
                  {r.description && (
                    <p className="text-[10px] text-muted-foreground truncate">{r.description}</p>
                  )}
                </div>
                <span className="text-xs font-medium tabular-nums shrink-0 ml-2">
                  {formatCurrency(remaining, { isPrivacyMode })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add LentSummary component for mobile dashboard"
```

---

### Task 7: Create GoalSummary

**Files:**
- Create: `components/dashboard/GoalSummary.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency } from '@/lib/utils';
import { calculateGoalStrategy } from '@/lib/finance-utils';
import { BudgetBreakdownItem } from './DailyOperationsCard';
import { Sparkles, ShieldCheck, CalendarClock } from 'lucide-react';

type SummaryData = {
  budgetBreakdown: BudgetBreakdownItem[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function GoalSummary({ summary, isPrivacyMode }: Props) {
  const goals = (summary?.budgetBreakdown || []).filter(
    (item: BudgetBreakdownItem) => item.categoryType === 'saving'
  );

  if (goals.length === 0) {
    return (
      <div>
        <p className="text-xs text-muted-foreground italic">No goals set.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
          Total Funds in Goals
        </p>
        <p className="text-2xl font-bold">
          {formatCurrency(
            goals.reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0),
            { isPrivacyMode }
          )}
        </p>
      </div>

      <div className="space-y-4">
        {goals.map((item: BudgetBreakdownItem) => {
          const hasMonthlyBudget = item.limit > 0;
          const displayTarget = hasMonthlyBudget ? item.limit : (item.targetAmount || 0);
          const displayCurrent = hasMonthlyBudget ? item.spent : item.accumulated;
          const percentage = displayTarget > 0 ? (displayCurrent / displayTarget) * 100 : 0;
          const isMet = hasMonthlyBudget && displayCurrent >= displayTarget;
          const globalTarget = item.targetAmount || 0;
          const strategy = calculateGoalStrategy(item.accumulated, globalTarget, item.targetDate);

          let typeIcon = Sparkles;
          let typeColor = 'text-chart-1';
          if (item.goalType === 'investment') typeIcon = ShieldCheck;
          else if (item.goalType === 'bill') typeIcon = CalendarClock;

          const Icon = typeIcon;

          return (
            <div key={item.categoryId} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon className={cn('h-3 w-3 shrink-0', typeColor)} />
                  <span className="text-xs font-medium truncate">{item.categoryName}</span>
                </div>
                <span className="text-xs font-medium tabular-nums shrink-0 ml-2">
                  {formatCurrency(displayCurrent, { isPrivacyMode })}
                  <span className="text-muted-foreground font-normal">
                    /{formatCurrency(displayTarget, { isPrivacyMode })}
                  </span>
                </span>
              </div>
              <Progress value={Math.min(100, percentage)} className="h-1.5" />
              <div className="flex justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {percentage.toFixed(0)}%
                </span>
                {isMet ? (
                  <span className="text-[10px] text-success font-medium">Done!</span>
                ) : strategy.monthly > 0 && !hasMonthlyBudget ? (
                  <span className="text-[10px] text-muted-foreground">
                    {formatCurrency(strategy.monthly, { isPrivacyMode })}/mo needed
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add GoalSummary component for mobile dashboard"
```

---

### Task 8: Create MobileDashboardTabs

**Files:**
- Create: `components/dashboard/MobileDashboardTabs.tsx`

- [ ] **Step 1: Write component**

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BalanceSummary } from './BalanceSummary';
import { LentSummary } from './LentSummary';
import { GoalSummary } from './GoalSummary';

type SummaryData = {
  liquidCash: number;
  cashAccounts: { name: string; balance: number }[];
  totalReceivables: number;
  pendingReceivables: any[];
  budgetBreakdown: any[];
};

type Props = {
  summary: SummaryData | undefined | null;
  isPrivacyMode?: boolean;
};

export function MobileDashboardTabs({ summary, isPrivacyMode }: Props) {
  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <Tabs defaultValue="balance" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="lent">Lent</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
          </TabsList>
          <TabsContent value="balance">
            <BalanceSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
          <TabsContent value="lent">
            <LentSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
          <TabsContent value="goals">
            <GoalSummary summary={summary} isPrivacyMode={isPrivacyMode} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — confirm no errors

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add MobileDashboardTabs with Balance/Lent/Goals tabs"
```

---

### Task 9: Update page.tsx Mobile Section

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add imports for new components**

Add after the existing WealthCard import:

```typescript
import { DailyGuidance } from '@/components/dashboard/DailyGuidance'
import { BudgetSummary } from '@/components/dashboard/BudgetSummary'
import { TodaySpending } from '@/components/dashboard/TodaySpending'
import { BudgetAttentionList } from '@/components/dashboard/BudgetAttentionList'
import { MobileDashboardTabs } from '@/components/dashboard/MobileDashboardTabs'
```

- [ ] **Step 2: Replace mobile carousel section**

Replace lines 178-204 (the mobile carousel section) with:

```tsx
      {/* Mobile: Daily Decision View (vertical scroll) */}
      <div className="block md:hidden space-y-4 mb-8">
        {summary === undefined ? (
          <DashboardCardSkeleton />
        ) : (
          <>
            <DailyGuidance summary={summary} isPrivacyMode={isPrivacyMode} />
            <BudgetSummary summary={summary} isPrivacyMode={isPrivacyMode} />
            <TodaySpending summary={summary} isPrivacyMode={isPrivacyMode} />
            <BudgetAttentionList summary={summary} isPrivacyMode={isPrivacyMode} />
            <MobileDashboardTabs summary={summary} isPrivacyMode={isPrivacyMode} />
          </>
        )}
      </div>
```

- [ ] **Step 3: Remove unused Carousel imports**

Remove these lines (if no longer used elsewhere):
```typescript
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
```

- [ ] **Step 4: Build**

Run: `npm run build` — confirm no errors

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: restructure mobile dashboard to vertical daily decision view"
```

---

### Verification

- [ ] **Run full build:** `npm run build` — must pass with no errors
- [ ] **Check linter:** `npm run lint` — note any pre-existing errors only (ignore `any` type issues in pre-existing files)
- [ ] **Push branch:** `git push -u origin phase-2-mobile-daily-view`

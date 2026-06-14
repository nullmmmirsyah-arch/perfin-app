# Mobile Dashboard Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the mobile dashboard by consolidating redundant cards, adding a hero summary with per-category daily allowances, compacting recurring bills with inline mark-paid action, and expanding the bottom nav to 5 visible items.

**Architecture:** All data is already fetched via `api.dashboard.getDashboardSummary` — no new queries. The restructure only reorganizes presentation. Four existing mobile components (DailyGuidance, BudgetSummary, TodaySpending, BudgetAttentionList) are absorbed into one `MobileBudgetToday` component. A new `MobileHeroSummary` shows primary metrics at the top. `MobileRecurringRow` replaces the full Card with a compact row. `BottomNav` gains 2 more items.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui, Convex, framer-motion, lucide-react

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-dashboard-restructure-design.md`

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `components/dashboard/MobileHeroSummary.tsx` | Gradient hero: total balance, budget left, daily allowance, fiscal day |
| `components/dashboard/MobileBudgetToday.tsx` | Consolidated card: status, overall progress, per-category daily allowance, today's expenses |
| `components/dashboard/MobileRecurringRow.tsx` | Compact recurring row with inline "Bayar" button |

### Modified files
| File | Change |
|------|--------|
| `components/dashboard/MobileDashboardTabs.tsx` | Show values on tab buttons |
| `components/BottomNav.tsx` | 5 visible items: Home, Trans, Budgets, Goals, Reports |
| `app/dashboard/page.tsx` | Wire new components, remove old imports from mobile section |

### Removed from mobile render path (components remain in codebase for desktop)
| Component | Reason |
|-----------|--------|
| `DailyGuidance` | Absorbed into MobileBudgetToday |
| `BudgetSummary` | Absorbed into MobileBudgetToday |
| `TodaySpending` | Absorbed into MobileBudgetToday |
| `BudgetAttentionList` | Absorbed into MobileBudgetToday |
| `RecurringSummary` (mobile only) | Replaced by MobileRecurringRow |

---

### Task 1: MobileHeroSummary

**Files:**
- Create: `components/dashboard/MobileHeroSummary.tsx`

- [ ] **Step 1: Read the spec and existing components for patterns**

Read `docs/superpowers/specs/2026-06-14-mobile-dashboard-restructure-design.md` section "1. Hero Summary".

Read `components/dashboard/DailyGuidance.tsx` and `components/dashboard/BudgetSummary.tsx` for existing Card patterns and `formatCurrency` usage.

- [ ] **Step 2: Create MobileHeroSummary component**

```tsx
'use client'

import { formatCurrency, cn } from '@/lib/utils'
import { calculateFiscalDaysRemaining, getFiscalDate, getFiscalMonthRange } from '@/lib/finance-utils'
import { differenceInCalendarDays } from 'date-fns'

type CashAccount = {
  name: string
  balance: number
  allocations?: { name: string; amount: number }[]
  bankBalance?: number
}

type SummaryData = {
  liquidCash: number
  remainingBudget: number
  cashAccounts: CashAccount[]
  budgetBreakdown: { limit: number }[]
  budgetStartDay?: number
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
}

export function MobileHeroSummary({ summary, isPrivacyMode }: Props) {
  const budgetStartDay = summary?.budgetStartDay
  const daysRemaining = calculateFiscalDaysRemaining(budgetStartDay)
  const now = new Date()
  const fiscalDate = getFiscalDate(now, budgetStartDay)
  const { start, end } = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), budgetStartDay)
  const totalFiscalDays = differenceInCalendarDays(end, start) + 1
  const fiscalDayNumber = differenceInCalendarDays(now, start) + 1
  const dailyAllowance = daysRemaining > 0
    ? Math.max(0, (summary?.remainingBudget || 0) / daysRemaining)
    : 0

  return (
    <div className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-5 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <p className="text-xs font-medium opacity-80 tracking-wide">TOTAL BALANCE</p>
          <p className="text-3xl font-bold tracking-tight">
            {formatCurrency(summary?.liquidCash || 0, { isPrivacyMode })}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-medium opacity-80 tracking-wide">BUDGET LEFT</p>
          <p className="text-xl font-semibold">
            {formatCurrency(summary?.remainingBudget || 0, { isPrivacyMode })}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between bg-black/10 rounded-xl px-4 py-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs opacity-80">Daily Allowance</span>
          <span className="text-lg font-bold">
            {formatCurrency(dailyAllowance, { isPrivacyMode })}
          </span>
        </div>
        <span className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
          Day {fiscalDayNumber}/{totalFiscalDays}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MobileHeroSummary.tsx
git commit -m "feat: add MobileHeroSummary component for mobile dashboard"
```

---

### Task 2: MobileBudgetToday (consolidated card)

**Files:**
- Create: `components/dashboard/MobileBudgetToday.tsx`

- [ ] **Step 1: Read spec and existing budget components**

Read `components/dashboard/DailyGuidance.tsx`, `components/dashboard/BudgetSummary.tsx`, `components/dashboard/TodaySpending.tsx`, `components/dashboard/BudgetAttentionList.tsx` to understand the existing data shapes and patterns.

Also read `lib/finance-utils.ts` for `calculateBudgetPace`.

- [ ] **Step 2: Create MobileBudgetToday component**

```tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, parseAmount } from '@/lib/utils'
import { calculateBudgetPace, calculateFiscalDaysRemaining } from '@/lib/finance-utils'
import Link from 'next/link'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type BudgetBreakdownItem = {
  categoryId: string
  categoryName: string
  categoryType: string
  limit: number
  spent: number
  remaining: number
  enablePacing?: boolean
  accumulated: number
  targetAmount?: number
  targetDate?: string
  goalType?: string
}

type SplitDetail = {
  categoryId: string
  amount: string
  description?: string
  labelId?: string
  categoryName?: string
  labelName?: string
  labelColor?: string
}

type TransactionWithDetails = {
  _id: string
  date: string
  amount: number | string
  type: string
  description?: string
  categoryName?: string
  isSplit?: boolean
  splits?: SplitDetail[]
}

type SummaryData = {
  remainingBudget: number
  budgetBreakdown: BudgetBreakdownItem[]
  recentTransactions: TransactionWithDetails[]
  budgetStartDay?: number
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
}

type OverallStatus = 'on_track' | 'spending_faster' | 'slow_down'

function computeOverallStatus(breakdown: BudgetBreakdownItem[], budgetStartDay?: number): OverallStatus {
  if (!breakdown || breakdown.length === 0) return 'on_track'
  const year = new Date().getFullYear()
  const month = new Date().getMonth()
  let hasWarning = false
  for (const item of breakdown) {
    if (item.enablePacing === false || item.limit <= 0) continue
    const pace = calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay)
    if (pace.status === 'danger') return 'slow_down'
    if (pace.status === 'warning') hasWarning = true
  }
  return hasWarning ? 'spending_faster' : 'on_track'
}

function isToday(dateStr: string): boolean {
  const today = new Date()
  const date = new Date(dateStr)
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

function getTxEntries(tx: TransactionWithDetails): { id: string; description: string; amount: number }[] {
  if (tx.isSplit && tx.splits && tx.splits.length > 0) {
    return tx.splits.map(split => ({
      id: tx._id + '-' + split.categoryId,
      description: split.description || tx.description || split.categoryName || 'Split',
      amount: parseAmount(split.amount),
    }))
  }
  return [{
    id: tx._id,
    description: tx.description || tx.categoryName || 'Transaction',
    amount: typeof tx.amount === 'string' ? parseAmount(tx.amount) : (tx.amount ?? 0),
  }]
}

export function MobileBudgetToday({ summary, isPrivacyMode }: Props) {
  const [showSafe, setShowSafe] = useState(false)

  const daysRemaining = calculateFiscalDaysRemaining(summary?.budgetStartDay)
  const totalBudget = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.limit, 0) || 0
  const totalSpent = summary?.budgetBreakdown?.reduce((acc, item) => acc + item.spent, 0) || 0
  const remaining = summary?.remainingBudget || 0
  const percentUsed = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const dailyAllowance = daysRemaining > 0 ? Math.max(0, remaining / daysRemaining) : 0
  const hasBudgets = (summary?.budgetBreakdown || []).length > 0
  const status = computeOverallStatus(summary?.budgetBreakdown || [], summary?.budgetStartDay)

  const todayTxns = (summary?.recentTransactions || []).filter(
    (tx: TransactionWithDetails) => isToday(tx.date) && tx.type === 'expense'
  )
  const todayEntries = todayTxns.flatMap(getTxEntries)
  const todaySpent = todayEntries.reduce((acc, entry) => acc + entry.amount, 0)

  const statusConfig = {
    on_track: { label: 'On Track', class: 'bg-success/10 text-success border-success/20' },
    spending_faster: { label: 'Spending Faster', class: 'bg-warning/10 text-warning border-warning/20' },
    slow_down: { label: 'Slow Down', class: 'bg-destructive/10 text-destructive border-destructive/20' },
  } as const
  const config = statusConfig[status]

  const year = new Date().getFullYear()
  const month = new Date().getMonth()

  const pacedItems = (summary?.budgetBreakdown || [])
    .filter(item => item.enablePacing !== false && item.limit > 0)
    .map(item => ({ ...item, pace: calculateBudgetPace(item.spent, item.limit, year, month, summary?.budgetStartDay) }))

  const dangerItems = pacedItems.filter(item => item.pace.status === 'danger')
  const warningItems = pacedItems.filter(item => item.pace.status === 'warning')
  const safeItems = pacedItems.filter(item => item.pace.status === 'safe')

  const getPaceBarColor = (status: string) => {
    switch (status) {
      case 'danger': return 'bg-destructive'
      case 'warning': return 'bg-warning'
      default: return 'bg-success'
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-5 space-y-4">
        {/* Status + overall progress */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground uppercase tracking-tighter font-semibold">
            Budget Today
          </p>
          {hasBudgets && (
            <Badge variant="outline" className={cn('text-xs font-semibold px-3 py-1', config.class)}>
              {config.label}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <Progress value={percentUsed} className="h-2" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{formatCurrency(totalSpent, { isPrivacyMode })} spent of {formatCurrency(totalBudget, { isPrivacyMode })}</span>
            <span>{daysRemaining > 0 ? `${daysRemaining}d left` : 'Final day'}</span>
          </div>
        </div>

        {/* Per-category daily allowance */}
        {hasBudgets && pacedItems.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tighter">
              Daily Allowance per Category
            </p>
            {[...dangerItems, ...warningItems].map(item => {
              const dailyLimit = item.pace.dailyLimit || 0
              const percent = dailyLimit > 0 ? Math.min(100, (item.spent / (item.limit / daysRemaining)) * 100) : 0
              return (
                <div key={item.categoryId} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate min-w-0 flex-1">{item.categoryName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', getPaceBarColor(item.pace.status))} style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums w-16 text-right">
                      {formatCurrency(item.remaining, { isPrivacyMode })}
                    </span>
                  </div>
                </div>
              )
            })}
            {safeItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground h-7 justify-start px-0 hover:bg-transparent"
                onClick={() => setShowSafe(!showSafe)}
              >
                {showSafe ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                {showSafe ? 'Hide on track budgets' : `${safeItems.length} other budget${safeItems.length > 1 ? 's' : ''} on track`}
              </Button>
            )}
            {showSafe && safeItems.map(item => {
              const dailyLimit = item.pace.dailyLimit || 0
              const percent = dailyLimit > 0 ? Math.min(100, (item.spent / (item.limit / daysRemaining)) * 100) : 0
              return (
                <div key={item.categoryId} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate min-w-0 flex-1">{item.categoryName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', getPaceBarColor(item.pace.status))} style={{ width: `${Math.min(100, percent)}%` }} />
                    </div>
                    <span className="text-xs font-medium tabular-nums w-16 text-right">
                      {formatCurrency(item.remaining, { isPrivacyMode })}
                    </span>
                  </div>
                </div>
              )
            })}
            <Link href="/budgets" className="block text-center text-[10px] text-primary underline underline-offset-2 mt-1">
              Lihat semua budget →
            </Link>
          </div>
        )}

        {/* Today's spending */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Spent Today</span>
            <span className="text-sm font-semibold">
              {formatCurrency(todaySpent, { isPrivacyMode })}
              <span className="text-xs text-muted-foreground font-normal">
                {' '}/ {formatCurrency(dailyAllowance, { isPrivacyMode })}
              </span>
            </span>
          </div>
          {todayEntries.length > 0 ? (
            <div className="space-y-0.5">
              {todayEntries.slice(0, 5).map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">• {entry.description}</span>
                  <span className="tabular-nums shrink-0 ml-2 text-destructive">-{formatCurrency(entry.amount, { isPrivacyMode })}</span>
                </div>
              ))}
              {todayEntries.length > 5 && (
                <p className="text-[10px] text-muted-foreground text-center pt-1">+{todayEntries.length - 5} more</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No spending yet today.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MobileBudgetToday.tsx
git commit -m "feat: add MobileBudgetToday consolidating 4 budget cards"
```

---

### Task 3: MobileRecurringRow

**Files:**
- Create: `components/dashboard/MobileRecurringRow.tsx`

- [ ] **Step 1: Read spec and existing recurring components**

Read `components/dashboard/RecurringSummary.tsx`, `components/recurring/RecurringList.tsx`, and `convex/recurring.ts` (especially the `markRecurringPaid` mutation at line 207).

- [ ] **Step 2: Create MobileRecurringRow component**

```tsx
'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Id } from '@/convex/_generated/dataModel'
import { formatCurrency, parseAmount } from '@/lib/utils'
import { Receipt, CheckCircle2, AlertCircle, CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import { useState } from 'react'

type Props = {
  householdId?: Id<"households">
  isPrivacyMode?: boolean
}

export function MobileRecurringRow({ householdId, isPrivacyMode }: Props) {
  const [expanded, setExpanded] = useState(false)
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentDay = now.getDate()

  const summary = useQuery(api.recurring.getRecurringSummary, { householdId: householdId ?? undefined, year, month })
  const markPaid = useMutation(api.recurring.markRecurringPaid)

  const handleMarkPaid = async (recurringExpenseId: Id<"recurringExpenses">) => {
    try {
      await markPaid({ recurringExpenseId, year, month })
      toast.success('Marked as paid')
    } catch {
      toast.error('Failed to mark as paid')
    }
  }

  if (summary === undefined) return null
  if (Number(summary.totalAmount) === 0) return null

  const hasItems = summary.overdue.length > 0 || summary.upcoming.length > 0

  return (
    <div className="w-full rounded-xl border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Recurring Bills</span>
          <span className="text-sm font-bold">{formatCurrency(summary.totalAmount, { isPrivacyMode })}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            {summary.paidCount > 0 && <span className="flex items-center gap-0.5 text-success"><CheckCircle2 className="h-3 w-3" />{summary.paidCount}</span>}
            {summary.overdueCount > 0 && <span className="flex items-center gap-0.5 text-destructive"><AlertCircle className="h-3 w-3" />{summary.overdueCount}</span>}
            {summary.unpaidCount > 0 && <span className="flex items-center gap-0.5 text-muted-foreground">{summary.unpaidCount}</span>}
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && hasItems && (
        <div className="px-4 pb-3 space-y-1 border-t border-border/30 pt-2">
          {summary.overdue.map((item: any) => (
            <div key={item._id} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                <span className="truncate">{item.name}</span>
                <span className="text-destructive shrink-0">— overdue {currentDay - item.dayOfMonth}d</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-medium tabular-nums text-destructive">{formatCurrency(parseAmount(item.amount), { isPrivacyMode })}</span>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs px-3 rounded-full"
                  onClick={(e) => { e.stopPropagation(); handleMarkPaid(item._id) }}
                >
                  Bayar
                </Button>
              </div>
            </div>
          ))}
          {summary.upcoming.map((item: any) => (
            <div key={item._id} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <CalendarClock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{item.name}</span>
                <span className="text-muted-foreground shrink-0">— due in {item.dayOfMonth - currentDay}d</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-medium tabular-nums">{formatCurrency(parseAmount(item.amount), { isPrivacyMode })}</span>
              </div>
            </div>
          ))}
          <div className="pt-1 text-center">
            <Link href="/recurring" className="text-xs text-primary underline underline-offset-2">
              Kelola recurring →
            </Link>
          </div>
        </div>
      )}

      {!expanded && summary.overdue.length > 0 && (
        <div className="px-4 pb-3 border-t border-border/30 pt-2 space-y-1">
          {summary.overdue.slice(0, 2).map((item: any) => (
            <div key={item._id} className="flex items-center justify-between text-xs py-0.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-medium tabular-nums text-destructive">{formatCurrency(parseAmount(item.amount), { isPrivacyMode })}</span>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 text-xs px-3 rounded-full"
                  onClick={(e) => { e.stopPropagation(); handleMarkPaid(item._id) }}
                >
                  Bayar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MobileRecurringRow.tsx
git commit -m "feat: add MobileRecurringRow with inline mark-paid action"
```

---

### Task 4: Update MobileDashboardTabs to show values on tab buttons

**Files:**
- Modify: `components/dashboard/MobileDashboardTabs.tsx`

- [ ] **Step 1: Read spec and current component**

Read `components/dashboard/MobileDashboardTabs.tsx` and check the summary data shape in `convex/dashboard.ts`.

The spec says: each tab button should display the total value alongside the label.

- [ ] **Step 2: Update MobileDashboardTabs with value labels**

Replace the file content:

```tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BalanceSummary } from './BalanceSummary'
import { LentSummary } from './LentSummary'
import { GoalSummary } from './GoalSummary'
import { formatCurrency } from '@/lib/utils'

type SummaryData = {
  liquidCash: number
  cashAccounts: { name: string; balance: number }[]
  totalReceivables: number
  pendingReceivables: any[]
  budgetBreakdown: any[]
}

type Props = {
  summary: SummaryData | undefined | null
  isPrivacyMode?: boolean
}

export function MobileDashboardTabs({ summary, isPrivacyMode }: Props) {
  const totalBalance = summary?.liquidCash || 0
  const totalLent = summary?.totalReceivables || 0
  const totalGoals = (summary?.budgetBreakdown || [])
    .filter((item: any) => item.categoryType === 'saving')
    .reduce((acc: number, item: any) => acc + (item.accumulated || 0), 0)

  return (
    <Card className="w-full">
      <CardContent className="pt-5">
        <Tabs defaultValue="balance" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-1.5 bg-transparent h-auto p-0 mb-4">
            <TabsTrigger
              value="balance"
              className="flex flex-col items-center gap-0.5 py-2.5 px-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground rounded-lg text-xs"
            >
              <span className="text-[10px] font-normal opacity-80">Balance</span>
              <span className="text-sm font-bold">{formatCurrency(totalBalance, { isPrivacyMode })}</span>
            </TabsTrigger>
            <TabsTrigger
              value="lent"
              className="flex flex-col items-center gap-0.5 py-2.5 px-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground rounded-lg text-xs"
            >
              <span className="text-[10px] font-normal opacity-80">Lent</span>
              <span className="text-sm font-bold">{formatCurrency(totalLent, { isPrivacyMode })}</span>
            </TabsTrigger>
            <TabsTrigger
              value="goals"
              className="flex flex-col items-center gap-0.5 py-2.5 px-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground rounded-lg text-xs"
            >
              <span className="text-[10px] font-normal opacity-80">Goals</span>
              <span className="text-sm font-bold">{formatCurrency(totalGoals, { isPrivacyMode })}</span>
            </TabsTrigger>
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
  )
}
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MobileDashboardTabs.tsx
git commit -m "feat: show values on MobileDashboardTabs tab buttons"
```

---

### Task 5: Update BottomNav to 5 visible items

**Files:**
- Modify: `components/BottomNav.tsx`

- [ ] **Step 1: Read spec and current BottomNav**

Read `components/BottomNav.tsx`. Current state: 3 visible items (Home, Trans, Budgets) + More drawer with 6 items.

New state: 5 visible items: Home, Trans, Budgets, Goals, Reports. No More drawer.

- [ ] **Step 2: Update BottomNav**

Replace the complete file content:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Target,
  FileBarChart,
} from 'lucide-react'

export function BottomNav() {
  const pathname = usePathname()

  const links = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/transactions', label: 'Trans', icon: ArrowLeftRight },
    { href: '/budgets', label: 'Budgets', icon: PiggyBank },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/report', label: 'Reports', icon: FileBarChart },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-0.5 transition-colors rounded-lg",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "fill-current/20")} />
              <span className="text-[10px] font-medium">{link.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add components/BottomNav.tsx
git commit -m "feat: expand BottomNav to 5 visible items (Home, Trans, Budgets, Goals, Reports)"
```

---

### Task 6: Wire new components in dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Read current dashboard page**

Read `app/dashboard/page.tsx`, focusing on the mobile section (lines 184-202).

Current mobile imports used:
- `DailyGuidance`, `BudgetSummary`, `TodaySpending`, `BudgetAttentionList`, `MobileDashboardTabs`, `RecurringSummary`

New mobile imports needed:
- `MobileHeroSummary`, `MobileBudgetToday`, `MobileDashboardTabs`, `MobileRecurringRow`

- [ ] **Step 2: Update imports and mobile render section**

Update imports (replace old with new):

```tsx
// Replace these imports:
// import { DailyOperationsCard } from '@/components/dashboard/DailyOperationsCard'
// import { DailyGuidance } from '@/components/dashboard/DailyGuidance'
// import { BudgetSummary } from '@/components/dashboard/BudgetSummary'
// import { TodaySpending } from '@/components/dashboard/TodaySpending'
// import { BudgetAttentionList } from '@/components/dashboard/BudgetAttentionList'
// import { MobileDashboardTabs } from '@/components/dashboard/MobileDashboardTabs'
// import { TransactionListGrouped } from '@/components/transactions/TransactionListGrouped'

// Keep DailyOperationsCard for desktop only
import { DailyOperationsCard } from '@/components/dashboard/DailyOperationsCard'

// New mobile components
import { MobileHeroSummary } from '@/components/dashboard/MobileHeroSummary'
import { MobileBudgetToday } from '@/components/dashboard/MobileBudgetToday'
import { MobileDashboardTabs } from '@/components/dashboard/MobileDashboardTabs'
import { MobileRecurringRow } from '@/components/dashboard/MobileRecurringRow'
```

Replace the mobile section (lines 184-202) with:

```tsx
      {/* Mobile: Daily Decision View (vertical scroll) */}
      <motion.div
        className="block md:hidden space-y-4 mb-8"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {summary === undefined ? (
          <DashboardCardSkeleton />
        ) : (
          <>
            <motion.div variants={fadeInUp}><MobileHeroSummary summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><MobileBudgetToday summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><MobileDashboardTabs summary={summary} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><MobileRecurringRow householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} /></motion.div>
            <motion.div variants={fadeInUp}><RecurringSummary householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} /></motion.div>
          </>
        )}
      </motion.div>
```

Note: Keep the `RecurringSummary` import and its usage for desktop (the mobile section replaces it with `MobileRecurringRow`, but the desktop grid in the `hidden md:grid` section still uses `RecurringSummary`). So don't remove the import.

- [ ] **Step 3: Run build check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: wire new mobile dashboard components into dashboard page"
```

---

### Task 7: Full build verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No type errors.

- [ ] **Step 2: Clean orphaned imports**

Search for any remaining unused imports of `DailyGuidance`, `BudgetSummary`, `TodaySpending`, `BudgetAttentionList` in the codebase:

```bash
rg "from.*DailyGuidance|from.*BudgetSummary|from.*TodaySpending|from.*BudgetAttentionList" --type ts
```

Expected: Only references in desktop-only paths or component files (not in the dashboard page mobile section).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```
Expected: No lint errors.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: cleanup unused imports after mobile dashboard restructure"
```

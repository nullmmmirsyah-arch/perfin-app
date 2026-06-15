# Desktop Dashboard Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 issues in the desktop dashboard across 3 priority groups (P1-P3).

**Architecture:** Quick-fix approach — each issue is fixed locally in its component file without structural refactoring. Cross-component interaction uses the existing custom DOM event pattern. New skeleton components added to existing skeletons file.

**Tech Stack:** Next.js 16 (App Router), React 19, Convex, shadcn/ui (New York), Tailwind v4, Lucide icons, Framer Motion

---

### Task 1: QuickAdjust Empty State (1.1)

**Files:**
- Modify: `components/dashboard/QuickAdjust.tsx:128-143`
- Modify: `app/dashboard/page.tsx:226-230`

- [ ] **Step 1: Return null from QuickAdjust when no items**

In `QuickAdjust.tsx`, change the empty state return block at line 128-143:

```tsx
  if (!summary || items.length === 0) {
    return null
  }
```

Remove the old card-with-message return. Clean up the unused `Card`, `CardHeader`, `CardTitle`, `CardContent` imports if they become unused after this change (but they're still used below, so keep them).

- [ ] **Step 2: Add conditional render in dashboard page**

In `app/dashboard/page.tsx`, wrap the QuickAdjust render with a check:

```tsx
{summary?.budgetBreakdown?.some((item: any) => item.enablePacing !== false && item.limit > 0) && (
  <QuickAdjust
    householdId={householdId ?? undefined}
    summary={summary}
    isPrivacyMode={isPrivacyMode}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/QuickAdjust.tsx app/dashboard/page.tsx
git commit -m "fix: hide QuickAdjust card when no budget items exist"
```

---

### Task 2: Privacy Mode on TransactionListGrouped (1.2)

**Files:**
- Modify: `components/transactions/TransactionListGrouped.tsx`
- Modify: `app/dashboard/page.tsx:262`

- [ ] **Step 1: Add isPrivacyMode prop to TransactionListGrouped**

In `TransactionListGrouped.tsx`, add `isPrivacyMode` to the Props interface and function signature:

```tsx
interface Props {
  transactions: TransactionWithDetails[];
  onEdit: (transaction: TransactionWithDetails) => void;
  onDelete: (transaction: TransactionWithDetails) => void;
  isPrivacyMode?: boolean;
  highlightLabelId?: string[];
  highlightCategoryId?: string[];
}

export function TransactionListGrouped({ transactions, onEdit, onDelete, isPrivacyMode, highlightLabelId, highlightCategoryId }: Props) {
```

- [ ] **Step 2: Replace local formatCurrency with shared one**

In `TransactionListGrouped.tsx`, replace the local `formatCurrency` function (line 59-64) with the shared one from `@/lib/utils`:

Remove:
```tsx
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  };
```

Add import at the top:
```tsx
import { formatCurrency } from '@/lib/utils'
```

Update the usage at line 82-84:
```tsx
{formatCurrency(Math.abs(dailyTotal), { isPrivacyMode })}
```

- [ ] **Step 3: Pass isPrivacyMode from dashboard page**

In `app/dashboard/page.tsx` line 259-263, pass the prop:

```tsx
<TransactionListGrouped 
    transactions={summary?.recentTransactions as TransactionWithDetails[] || []}
    onEdit={handleEdit}
    onDelete={setTransactionToDelete}
    isPrivacyMode={isPrivacyMode}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/transactions/TransactionListGrouped.tsx app/dashboard/page.tsx
git commit -m "fix: add privacy mode masking to desktop recent transactions"
```

---

### Task 3: TrendChart Month Range Control (2.2)

**Files:**
- Modify: `components/dashboard/TrendChart.tsx`

- [ ] **Step 1: Add range state and ViewToggle**

In `TrendChart.tsx`, add a month range state and toggle buttons in the CardHeader:

```tsx
import { useState } from 'react'
import { ViewToggle } from '@/components/ui/view-toggle'

export function TrendChart({ householdId, isPrivacyMode }: Props) {
  const [range, setRange] = useState(3)

  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months: range,
  })
```

Wait — check if `ViewToggle` exists in the codebase. Let me check.

- [ ] **Step 1 (revised): Add range state and inline toggle buttons**

Since there might not be a ViewToggle component, use inline buttons:

```tsx
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function TrendChart({ householdId, isPrivacyMode }: Props) {
  const [range, setRange] = useState(3)

  const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months: range,
  })
```

In the CardHeader, after the title:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/TrendChart.tsx
git commit -m "feat: add month range toggle to TrendChart (3/6/12mo)"
```

---

### Task 4: DailyOperationsCard Visual Hierarchy (2.3)

**Files:**
- Modify: `components/dashboard/DailyOperationsCard.tsx`

- [ ] **Step 1: Add Collapsible import and group the budget items**

In `DailyOperationsCard.tsx`, add imports:

```tsx
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
```

- [ ] **Step 2: Group items by status**

Replace the flat `.map()` in the Budget tab with grouped sections. After the `daysRemaining` calculation and before the `.map()`, compute groups:

```tsx
// Inside DailyOperationsCard, before the budget breakdown map
const expenseItems = (summary?.budgetBreakdown || [])
  .filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving')
  .sort((a, b) => {
    // existing sort logic...
  })

const now = new Date();
const { year, month } = getFiscalDateDetails(now.toISOString(), budgetStartDay);

const getStatus = (item: BudgetBreakdownItem): 'over' | 'warning' | 'safe' => {
  if (item.spent > item.limit) return 'over'
  if (!item.enablePacing || item.limit <= 0) return 'safe'
  const p = calculateBudgetPace(item.spent, item.limit, year, month, budgetStartDay)
  if (p.status === 'danger') return 'over'
  if (p.status === 'warning') return 'warning'
  return 'safe'
}

const overBudget = expenseItems.filter(i => getStatus(i) === 'over')
const warningItems = expenseItems.filter(i => getStatus(i) === 'warning')
const safeItems = expenseItems.filter(i => getStatus(i) === 'safe')
```

- [ ] **Step 3: Render grouped sections**

Replace the existing `.map()` block with grouped rendering:

```tsx
<div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin pb-12">
  {/* Over Budget */}
  {overBudget.length > 0 && (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Over Budget ({overBudget.length})
      </p>
      {overBudget.map((item, i) => (
        <BudgetRow key={i} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
      ))}
    </div>
  )}

  {/* Watch */}
  {warningItems.length > 0 && (
    <div className="space-y-1">
      <p className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
        Watch ({warningItems.length})
      </p>
      {warningItems.map((item, i) => (
        <BudgetRow key={i} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
      ))}
    </div>
  )}

  {/* On Track (collapsible if > 3) */}
  {safeItems.length > 0 && (
    <Collapsible defaultOpen={safeItems.length <= 3} className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success/50" />
          On Track ({safeItems.length})
        </p>
        {safeItems.length > 3 && (
          <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
            <span>{safeItems.length - 3} more</span>
            <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
        )}
      </div>
      {safeItems.slice(0, 3).map((item, i) => (
        <BudgetRow key={i} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
      ))}
      <CollapsibleContent className="space-y-1">
        {safeItems.slice(3).map((item, i) => (
          <BudgetRow key={i + 3} item={item} daysRemaining={daysRemaining} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )}

  {expenseItems.length === 0 && (
    <EmptyState compact icon={Wallet} description="No expense budgets set." />
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/DailyOperationsCard.tsx
git commit -m "feat: group budget items by status (Over/Watch/On Track)"
```

---

### Task 5: RecurringSummary Mark Paid Inline (2.5)

**Files:**
- Modify: `components/dashboard/RecurringSummary.tsx`

- [ ] **Step 1: Add markPaid mutation and inline button**

In `RecurringSummary.tsx`, add:

```tsx
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Loader2 } from 'lucide-react'

export function RecurringSummary({ householdId, isPrivacyMode }: Props) {
  const markPaid = useMutation(api.recurring.markRecurringPaid)
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set())

  const handleMarkPaid = async (id: string) => {
    setPayingIds(prev => new Set(prev).add(id))
    try {
      await markPaid({ id: id as any })
      toast.success("Marked as paid")
    } catch {
      toast.error("Failed to mark as paid")
    } finally {
      setPayingIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }
```

- [ ] **Step 2: Add Mark Paid button to each overdue/upcoming item**

Inside the `.overdue.map()` and `.upcoming.map()` blocks, add a small button:

For overdue items:
```tsx
<div key={item._id} className="flex items-center justify-between text-xs">
  <span className="flex items-center gap-1 truncate text-destructive">
    <AlertCircle className="h-3 w-3 shrink-0" />
    {item.name} — overdue {currentDay - item.dayOfMonth}d
  </span>
  <div className="flex items-center gap-2 shrink-0 ml-2">
    <span className="tabular-nums text-destructive">
      {formatCurrency(parseAmount(item.amount), { isPrivacyMode })}
    </span>
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px]"
      disabled={payingIds.has(item._id)}
      onClick={() => handleMarkPaid(item._id)}
    >
      {payingIds.has(item._id) ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        'Mark Paid'
      )}
    </Button>
  </div>
</div>
```

For upcoming items:
```tsx
<div key={item._id} className="flex items-center justify-between text-xs text-muted-foreground">
  <span className="flex items-center gap-1 truncate">
    <CalendarClock className="h-3 w-3 shrink-0" />
    {item.name} — due in {item.dayOfMonth - currentDay}d
  </span>
  <div className="flex items-center gap-2 shrink-0 ml-2">
    <span className="tabular-nums">
      {formatCurrency(parseAmount(item.amount), { isPrivacyMode })}
    </span>
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-[10px]"
      disabled={payingIds.has(item._id)}
      onClick={() => handleMarkPaid(item._id)}
    >
      {payingIds.has(item._id) ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        'Mark Paid'
      )}
    </Button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/RecurringSummary.tsx
git commit -m "feat: add inline Mark Paid button to RecurringSummary"
```

---

### Task 6: Loading States per Component (3.1)

**Files:**
- Modify: `components/skeletons.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add component-specific skeletons**

In `components/skeletons.tsx`, add 5 new skeleton components:

```tsx
export function DailyOperationsCardSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 bg-muted rounded-md animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded-md animate-pulse" />
        <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
      </div>
      <div className="h-8 w-32 bg-muted rounded animate-pulse" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendChartSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-4">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="flex items-end gap-2 h-[200px] pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 space-y-1">
            <div
              className="w-full bg-muted rounded-t animate-pulse"
              style={{ height: `${40 + i * 20}px` }}
            />
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MonthlyComparisonSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-4">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="h-10 w-20 bg-muted rounded animate-pulse" />
      <div className="h-3 w-48 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function RecurringSummarySkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-3">
      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
      <div className="flex justify-between">
        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex gap-3">
        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
        <div className="h-3 w-12 bg-muted rounded animate-pulse" />
      </div>
    </div>
  )
}

export function QuickAdjustSkeleton() {
  return (
    <div className="w-full rounded-xl border bg-card p-6 space-y-4">
      <div className="flex justify-between">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="h-6 w-14 bg-muted rounded animate-pulse" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            <div className="h-6 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
        </div>
      ))}
      <div className="h-8 w-full bg-muted rounded-lg animate-pulse" />
    </div>
  )
}
```

- [ ] **Step 2: Import skeletons in dashboard page**

In `app/dashboard/page.tsx`, update the import:

```tsx
import { 
  DashboardCardSkeleton, 
  RecentTransactionsSkeleton,
  DailyOperationsCardSkeleton,
  TrendChartSkeleton,
  MonthlyComparisonSkeleton,
  RecurringSummarySkeleton,
  QuickAdjustSkeleton
} from '@/components/skeletons'
```

- [ ] **Step 3: Replace generic skeletons with specific ones**

In the desktop grid section (lines 211-239), replace the generic skeleton render:

```tsx
{summary === undefined ? (
    <>
        <motion.div variants={scaleIn}><DailyOperationsCardSkeleton /></motion.div>
        <motion.div variants={scaleIn}><QuickAdjustSkeleton /></motion.div>
        <motion.div variants={scaleIn}><TrendChartSkeleton /></motion.div>
        <motion.div variants={scaleIn}><MonthlyComparisonSkeleton /></motion.div>
        <motion.div variants={scaleIn}><RecurringSummarySkeleton /></motion.div>
    </>
) : ( ... )}
```

Note: The grid is `md:grid-cols-2`, so 5 skeletons will flow naturally (top-left, top-right, mid-left, mid-right, bottom-left spanning/flowing). Since we have an odd number, the last one will wrap to the next row. This is acceptable for a loading state.

- [ ] **Step 4: Commit**

```bash
git add components/skeletons.tsx app/dashboard/page.tsx
git commit -m "feat: add component-specific loading skeletons for desktop dashboard"
```

---

### Task 7: Error States (3.2)

**Files:**
- Create: `components/ui/error-state.tsx`
- Modify: `components/dashboard/DailyOperationsCard.tsx`
- Modify: `components/dashboard/TrendChart.tsx`
- Modify: `components/dashboard/MonthlyComparison.tsx`
- Modify: `components/dashboard/RecurringSummary.tsx`
- Modify: `components/dashboard/QuickAdjust.tsx`

- [ ] **Step 1: Create ErrorState component**

Create `components/ui/error-state.tsx`:

```tsx
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  title?: string
  message?: string
  onRetry?: () => void
  compact?: boolean
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Failed to load data. Please try again.',
  onRetry,
  compact = false,
}: Props) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-6' : 'py-12'}`}>
      <AlertCircle className={`text-destructive mb-2 ${compact ? 'h-5 w-5' : 'h-8 w-8'}`} />
      <h3 className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h3>
      <p className={`text-muted-foreground mt-1 max-w-[200px] ${compact ? 'text-[10px]' : 'text-xs'}`}>{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 h-7 text-xs gap-1">
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add error state handling to each dashboard component**

Convex returns `data === undefined` when loading and `data === null` when an error occurs. Update each component:

**TrendChart.tsx** — add between loading and empty check:
```tsx
if (trends === null) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorState compact />
      </CardContent>
    </Card>
  )
}
```

**MonthlyComparison.tsx** — add after the trends === undefined check:
```tsx
if (trends === null) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorState compact />
      </CardContent>
    </Card>
  )
}
```

**RecurringSummary.tsx** — add after the undefined check:
```tsx
if (summary === null) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorState compact />
      </CardContent>
    </Card>
  )
}
```

**QuickAdjust.tsx** — update the empty items check to also check null:
The current check at line 128 `if (!summary || items.length === 0)` already returns early. After Task 1 it returns `null`. No additional change needed since `items` would be empty if summary is null.

**DailyOperationsCard.tsx** — add at the beginning of the component body:
```tsx
if (!summary) {
  return (
    <Card className="w-full">
      <CardContent>
        <ErrorState compact />
      </CardContent>
    </Card>
  )
}
```

Note: `summary` from `getDashboardSummary` returns `null` on error, same as other queries. But `DailyOperationsCard` receives it as a prop from the parent, which already handles the loading state. However, if the parent somehow passes null, the guard is useful.

- [ ] **Step 3: Commit**

```bash
git add components/ui/error-state.tsx components/dashboard/TrendChart.tsx components/dashboard/MonthlyComparison.tsx components/dashboard/RecurringSummary.tsx components/dashboard/DailyOperationsCard.tsx
git commit -m "feat: add ErrorState component and error handling to dashboard cards"
```

---

### Task 8: Cross-Component Interaction (3.4)

**Files:**
- Modify: `components/dashboard/DailyOperationsCard.tsx`
- Modify: `components/dashboard/TrendChart.tsx`
- Modify: `components/dashboard/MonthlyComparison.tsx`

- [ ] **Step 1: Dispatch custom event from DailyOperationsCard**

In `DailyOperationsCard.tsx`'s `BudgetRow`, modify the Link click to also dispatch a filter event. Keep the Link navigation, but add an onClick handler:

In the Link component inside `BudgetRow` (line 77-79):
```tsx
<Link 
    href={`/categories/${item.categoryId}`} 
    className="group flex flex-col gap-1.5 p-2 -mx-2 rounded-lg hover:bg-accent/50 transition-colors"
    onClick={(e) => {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('PERFIN_FILTER_CATEGORY', { 
            detail: { categoryId: item.categoryId, categoryName: item.categoryName }
        }))
    }}
>
```

Wait — this would prevent navigation entirely. Let me rethink. The event should fire BEFORE navigation, but navigation should still happen. Let me use a separate clickable area:

Actually, looking at the mobile behavior: clicking a category in the desktop card currently navigates to `/categories/[id]`. The cross-component interaction should be **additive** — not replacing navigation. Let me make the row click dispatch the event AND navigate.

Better approach: add a small filter icon button on each row that dispatches the filter event, while the row itself still navigates as before.

```tsx
// Inside the flex justify-between items-start in BudgetRow
<div className="flex items-center gap-1">
    {/* Filter button */}
    <button
        onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('PERFIN_FILTER_CATEGORY', { 
                detail: { categoryId: item.categoryId, categoryName: item.categoryName }
            }))
        }}
        className="h-5 w-5 rounded flex items-center justify-center hover:bg-accent transition-colors"
        title="Highlight in charts"
    >
        <Search className="h-3 w-3 text-muted-foreground/50 hover:text-foreground" />
    </button>
    {/* Safe Daily Badge */}
    {!isOver && item.remaining > 0 && safeSpend > 0 ? ( ... ) : ...}
    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
</div>
```

Add `Search` to the lucide-react import line 4:
```tsx
import { Wallet, Info, CalendarClock, ChevronDown, ChevronUp, CheckCircle2, HandCoins, User2, ArrowRightLeft, Check, Trash2, Ban, ChevronRight, Landmark, Search } from 'lucide-react';
```

- [ ] **Step 2: Listen for filter event in TrendChart**

In `TrendChart.tsx`, add a useEffect to listen for the filter event:

```tsx
import { useEffect } from 'react'

export function TrendChart({ householdId, isPrivacyMode }: Props) {
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const { categoryName } = e.detail
      setHighlightedCategory(prev => prev === categoryName ? null : categoryName)
    }
    window.addEventListener('PERFIN_FILTER_CATEGORY', handler)
    return () => window.removeEventListener('PERFIN_FILTER_CATEGORY', handler)
  }, [])
```

Use `highlightedCategory` to dim non-matching bars or categories in the chart. In the bar rendering or legend:

```tsx
const bars = barNames.map((name, i) => (
  <Bar
    key={name}
    dataKey={name}
    stackId="spending"
    fill={chartConfig[name]?.color}
    radius={i === barNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
    opacity={highlightedCategory && name !== highlightedCategory ? 0.3 : 1}
  />
))
```

- [ ] **Step 3: Listen for filter event in MonthlyComparison**

In `MonthlyComparison.tsx`, add:

```tsx
import { useEffect, useState } from 'react'

export function MonthlyComparison({ householdId, isPrivacyMode }: Props) {
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const { categoryId } = e.detail
      setHighlightedCategory(prev => prev === categoryId ? null : categoryId)
    }
    window.addEventListener('PERFIN_FILTER_CATEGORY', handler)
    return () => window.removeEventListener('PERFIN_FILTER_CATEGORY', handler)
  }, [])
```

Then filter the `topChanges` or highlight the matching category:

```tsx
{topChanges.map(cat => (
  <div key={cat.id} className={cn(
    'flex items-center justify-between text-xs',
    highlightedCategory && cat.id !== highlightedCategory ? 'opacity-30' : '',
    highlightedCategory === cat.id ? 'font-bold text-primary' : ''
  )}>
    <span className="truncate">{cat.name}</span>
    <span className={cn(...)}>{...}</span>
  </div>
))}
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/DailyOperationsCard.tsx components/dashboard/TrendChart.tsx components/dashboard/MonthlyComparison.tsx
git commit -m "feat: add cross-component category filter via custom events"
```

---

### Task 9: MonthlyComparison Custom Period (3.5)

**Files:**
- Modify: `components/dashboard/MonthlyComparison.tsx`

- [ ] **Step 1: Add compare mode toggle**

In `MonthlyComparison.tsx`, add state and toggle:

```tsx
const [compareMode, setCompareMode] = useState<'last' | 'avg3'>('last')

// Fetch enough data for both modes
const monthsToFetch = compareMode === 'avg3' ? 4 : 2
const trends = useQuery(api.dashboard.getMonthlyTrends, {
    householdId: householdId ?? undefined,
    months: monthsToFetch,
})
```

In the CardHeader:
```tsx
<CardHeader className="pb-3 flex flex-row items-center justify-between">
  <CardTitle className="text-sm font-medium text-muted-foreground">vs Last Month</CardTitle>
  <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
    {(['last', 'avg3'] as const).map((mode) => (
      <button
        key={mode}
        onClick={() => setCompareMode(mode)}
        className={cn(
          'px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors',
          compareMode === mode
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {mode === 'last' ? 'vs Last Mo' : 'vs Avg 3mo'}
      </button>
    ))}
  </div>
</CardHeader>
```

- [ ] **Step 2: Add avg3 comparison logic**

After the existing `lastMonth` calculation, add the average logic:

```tsx
let comparisonLabel = 'last month'
let comparisonTotal = lastMonth.totalSpent
let comparisonCategories = lastMonth.categories

if (compareMode === 'avg3' && trends.length >= 4) {
  comparisonLabel = '3mo average'
  const avgMonths = trends.slice(1, 4) // months 2, 3, 4
  comparisonTotal = Math.round(avgMonths.reduce((sum, m) => sum + m.totalSpent, 0) / 3)
  
  // Average per category
  const catMap = new Map<string, { name: string; spent: number }[]>()
  for (const m of avgMonths) {
    for (const c of m.categories) {
      const existing = catMap.get(c.categoryId)
      if (existing) {
        existing.push(c)
      } else {
        catMap.set(c.categoryId, [c])
      }
    }
  }
  comparisonCategories = Array.from(catMap.entries()).map(([id, cats]) => ({
    categoryId: id,
    categoryName: cats[0].categoryName,
    spent: Math.round(cats.reduce((s, c) => s + c.spent, 0) / cats.length),
  }))
}

const diff = thisMonth.totalSpent - comparisonTotal
const pctChange = comparisonTotal > 0 ? Math.round((diff / comparisonTotal) * 100) : 0
```

- [ ] **Step 3: Update display text**

Update the text to use dynamic label:
```tsx
<p className="text-xs text-muted-foreground mb-4">
  {formatCurrency(thisMonth.totalSpent, { isPrivacyMode })} this month &middot;{' '}
  {formatCurrency(comparisonTotal, { isPrivacyMode })} {comparisonLabel}
</p>
```

And update the category comparison to use `comparisonCategories`:

Replace `lastMonth.categories` references with `comparisonCategories` in the category diff logic (lines 69-83).

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/MonthlyComparison.tsx
git commit -m "feat: add vs average 3mo comparison mode to MonthlyComparison"
```

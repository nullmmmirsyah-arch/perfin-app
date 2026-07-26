# Budget Allocation Hero Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small "Unassigned Cash" pill on the budget page with a prominent Allocation Progress Hero Card that motivates users to assign 100% of their income using psychological principles (Goal Gradient, Completion Bias, Loss Aversion).

**Architecture:** Extract a new `AllocationProgressCard` component + `getAllocationNudge` helper. Modify the budget page to remove the old pill, add the hero card, simplify the Expenses Summary Card, and add confetti celebration on 100% allocation. No data model or Convex changes — all data already available from existing `breakdown` object.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, shadcn/ui, framer-motion, canvas-confetti, lucide-react, date-fns, Convex

## Global Constraints

- Use `--webpack` for dev/build (Turbopack not supported)
- Use `cn()` from `@/lib/utils` for conditional classes
- Use `formatCurrency()` from `@/lib/utils` for formatting
- Follow existing component patterns: `motion.div` with `fadeInUp` variants, shadcn/ui components
- Use `navigator.vibrate(10)` on interactive actions
- No comments unless asked
- No new Convex functions or schema changes

---

### Task 1: Create `getAllocationNudge` helper function

**Files:**
- Create: `lib/allocation-nudge.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `getAllocationNudge(percent: number, remaining: number)` returning `{ message: string; variant: 'default' | 'success' | 'warning' }`

- [ ] **Step 1: Create the helper file**

```ts
// lib/allocation-nudge.ts
import { formatCurrency } from '@/lib/utils'

export function getAllocationNudge(
  percent: number,
  remaining: number
): { message: string; variant: 'default' | 'success' | 'warning' } {
  if (percent < 0) {
    return {
      message: `Over-allocated by ${formatCurrency(Math.abs(remaining))}. Move funds to fix.`,
      variant: 'warning',
    }
  }
  if (percent === 0) {
    return {
      message: 'Start assigning your income to categories.',
      variant: 'default',
    }
  }
  if (percent < 50) {
    return {
      message: `Great start! ${formatCurrency(remaining)} still needs a home.`,
      variant: 'default',
    }
  }
  if (percent < 80) {
    return {
      message: `Almost halfway! Just ${formatCurrency(remaining)} left.`,
      variant: 'default',
    }
  }
  if (percent < 100) {
    return {
      message: `So close! ${formatCurrency(remaining)} to reach zero-based.`,
      variant: 'default',
    }
  }
  return {
    message: 'Every rupiah has a job!',
    variant: 'success',
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/allocation-nudge.ts
git commit -m "feat: add allocation nudge helper for zero-based budget motivation"
```

---

### Task 2: Create `AllocationProgressCard` component

**Files:**
- Create: `components/budgets/AllocationProgressCard.tsx`

**Interfaces:**
- Consumes: `unassignedCash: number`, `breakdown: { pastSurplus: number; thisMonthIncome: number; thisMonthBudgeted: number } | undefined`, `onMoveFunds: () => void`, `isAdmin: boolean`, `isPastMonth: boolean`
- Produces: React component rendering the hero card

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { PieChart, ArrowRight } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { fadeInUp } from '@/lib/animations'
import { getAllocationNudge } from '@/lib/allocation-nudge'
import confetti from 'canvas-confetti'

interface AllocationProgressCardProps {
  unassignedCash: number
  breakdown: {
    pastSurplus: number
    thisMonthIncome: number
    thisMonthBudgeted: number
  } | undefined
  onMoveFunds: () => void
  isAdmin: boolean
  isPastMonth: boolean
}

export default function AllocationProgressCard({
  unassignedCash,
  breakdown,
  onMoveFunds,
  isAdmin,
  isPastMonth,
}: AllocationProgressCardProps) {
  const prevPercentRef = useRef<number | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  const totalIncome = (breakdown?.pastSurplus ?? 0) + (breakdown?.thisMonthIncome ?? 0)
  const totalBudgeted = breakdown?.thisMonthBudgeted ?? 0
  const allocationPercent = totalIncome > 0
    ? Math.min(100, Math.max(0, (totalBudgeted / totalIncome) * 100))
    : 0
  const displayPercent = Math.round(allocationPercent)

  const nudge = getAllocationNudge(
    totalIncome > 0 ? (totalBudgeted / totalIncome) * 100 : 0,
    unassignedCash
  )

  useEffect(() => {
    const prev = prevPercentRef.current
    if (prev !== null && prev < 100 && allocationPercent >= 100) {
      setShowCelebration(true)
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        })
      }
      const timer = setTimeout(() => setShowCelebration(false), 3000)
      return () => clearTimeout(timer)
    }
    prevPercentRef.current = allocationPercent
  }, [allocationPercent])

  if (!isAdmin || isPastMonth || totalIncome === 0) return null

  const isComplete = unassignedCash === 0
  const isOver = unassignedCash < 0

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-card border rounded-xl p-5 shadow-sm overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <PieChart className="h-24 w-24 rotate-12" />
      </div>
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            Budget Allocation
          </p>
          {isComplete && (
            <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">
              Complete
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className={cn(
            'text-4xl font-black tracking-tighter',
            isOver ? 'text-destructive' : isComplete ? 'text-success' : 'text-foreground'
          )}>
            {displayPercent}%
          </span>
          <span className="text-sm text-muted-foreground font-medium">assigned</span>
        </div>

        <Progress
          value={allocationPercent}
          className={cn(
            'h-3.5',
            isComplete ? '[&>div]:bg-success' : isOver ? '[&>div]:bg-destructive' : ''
          )}
        />

        <p className="text-xs text-muted-foreground">
          {formatCurrency(totalBudgeted)} dari {formatCurrency(totalIncome)} assigned
        </p>

        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[100px] bg-muted/40 px-3 py-2 rounded-lg border border-muted/50">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Income</p>
            <p className="text-sm font-bold tracking-tight">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="flex-1 min-w-[100px] bg-muted/40 px-3 py-2 rounded-lg border border-muted/50">
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Budgeted</p>
            <p className="text-sm font-bold tracking-tight">{formatCurrency(totalBudgeted)}</p>
          </div>
          <div className={cn(
            'flex-1 min-w-[100px] px-3 py-2 rounded-lg border',
            isOver
              ? 'bg-destructive/5 border-destructive/20'
              : isComplete
                ? 'bg-success/5 border-success/20'
                : 'bg-primary/5 border-primary/10'
          )}>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight mb-0.5">Unassigned</p>
            <p className={cn(
              'text-sm font-bold tracking-tight',
              isOver ? 'text-destructive' : isComplete ? 'text-success' : 'text-primary'
            )}>
              {formatCurrency(unassignedCash)}
            </p>
          </div>
        </div>

        <p className={cn(
          'text-xs italic',
          nudge.variant === 'success' ? 'text-success' : 'text-muted-foreground'
        )}>
          {nudge.message}
        </p>

        {!isComplete && (
          <Button
            variant="default"
            size="sm"
            onClick={onMoveFunds}
            className="w-full h-9 text-xs"
          >
            Move Funds
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        )}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build --webpack 2>&1 | head -30`
Expected: No errors related to the new component

- [ ] **Step 3: Commit**

```bash
git add components/budgets/AllocationProgressCard.tsx
git commit -m "feat: add AllocationProgressCard hero component"
```

---

### Task 3: Integrate AllocationProgressCard into budget page and remove old Unassigned pill

**Files:**
- Modify: `app/budgets/page.tsx`

**Interfaces:**
- Consumes: `AllocationProgressCard` from Task 2, `getAllocationNudge` from Task 1
- Produces: Updated budget page with hero card and no old pill

- [ ] **Step 1: Add imports**

Add to the top of `app/budgets/page.tsx`:

```tsx
import AllocationProgressCard from '@/components/budgets/AllocationProgressCard'
```

- [ ] **Step 2: Remove the mobile Unassigned pill (lines 257-298)**

Delete the entire `{isAdmin && !isPastMonth && (` Popover block in the mobile header section (the one between the month navigator and the "Move Funds" button).

- [ ] **Step 3: Remove the desktop Unassigned pill (lines 370-410)**

Delete the entire `{isAdmin && !isPastMonth && (` Popover block in the desktop header section (after the "Move Funds" button).

- [ ] **Step 4: Add AllocationProgressCard after mobile header**

After the mobile header's closing `</motion.div>` (around line 310), add:

```tsx
{/* Allocation Progress Hero Card */}
{isAdmin && !isPastMonth && (
  <div className="mb-4 md:hidden">
    <AllocationProgressCard
      unassignedCash={unassignedCash}
      breakdown={breakdown}
      onMoveFunds={() => setMoveFundsOpen(true)}
      isAdmin={isAdmin}
      isPastMonth={isPastMonth}
    />
  </div>
)}
```

- [ ] **Step 5: Add AllocationProgressCard after desktop header**

After the desktop header's closing `</div>` (around line 412), add:

```tsx
{/* Allocation Progress Hero Card */}
{isAdmin && !isPastMonth && (
  <div className="hidden md:block mb-6">
    <AllocationProgressCard
      unassignedCash={unassignedCash}
      breakdown={breakdown}
      onMoveFunds={() => setMoveFundsOpen(true)}
      isAdmin={isAdmin}
      isPastMonth={isPastMonth}
    />
  </div>
)}
```

- [ ] **Step 6: Remove unused imports**

Remove `Info` and `Popover`/`PopoverContent`/`PopoverTrigger` from imports if they are no longer used elsewhere in the file. Check if `Popover` is used anywhere else first — it is used in `BudgetDrawer` and `MoveFundsDrawer` but those are separate components. If `Info` is used in the Expenses Summary Card's swept amount section, keep it.

- [ ] **Step 7: Verify it compiles**

Run: `npm run build --webpack 2>&1 | head -30`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add app/budgets/page.tsx
git commit -m "feat: integrate AllocationProgressCard and remove old unassigned pill"
```

---

### Task 4: Simplify Expenses Summary Card

**Files:**
- Modify: `app/budgets/page.tsx`

**Interfaces:**
- Consumes: existing `budgetSummary` prop
- Produces: Simplified Expenses Summary Card without allocation stats

- [ ] **Step 1: Remove "New Planned" and "Adjustments" stat blocks**

In the Expenses Summary Card section (around lines 635-652), remove the entire `<div className="flex flex-wrap gap-2">` block that contains "New Planned" and "Adjustments" stat blocks.

- [ ] **Step 2: Add "days left" and "daily burn" info**

After the spending progress bar (around line 662), add before the swept amount info:

```tsx
<div className="flex items-center justify-between text-[10px] text-muted-foreground">
  <span>{calculatedDaysRemaining} days left</span>
  {(budgetSummary?.totalEffective ?? 0) > 0 && calculatedDaysRemaining > 0 && (
    <span>
      {formatCurrency((budgetSummary?.totalRemaining ?? 0) / calculatedDaysRemaining)}/day avg
    </span>
  )}
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build --webpack 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/budgets/page.tsx
git commit -m "feat: simplify Expenses Summary Card to focus on spending"
```

---

### Task 5: Final verification and polish

**Files:**
- Review: `app/budgets/page.tsx`, `components/budgets/AllocationProgressCard.tsx`, `lib/allocation-nudge.ts`

- [ ] **Step 1: Run full build**

Run: `npm run build --webpack`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No new lint errors

- [ ] **Step 3: Manual visual check**

Verify in browser:
- Mobile: AllocationProgressCard appears below header, is prominent, progress bar animates
- Desktop: AllocationProgressCard appears below header, same behavior
- Old "Unassigned" pill is gone from both layouts
- Expenses Summary Card no longer shows "New Planned" / "Adjustments"
- When unassigned = 0, card shows green "Complete" badge and no Move Funds button
- When unassigned > 0, Move Funds button is present and functional
- Confetti fires when transitioning from <100% to 100% (test by editing a budget)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: polish allocation hero card based on visual review"
```

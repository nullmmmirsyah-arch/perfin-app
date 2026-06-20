# Budget Category Detail Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom sheet to the mobile Budget Today card showing per-category detail (remaining budget, weekly allowance) without cluttering the main card.

**Architecture:** Create a standalone `BudgetCategorySheet` component that renders inside `MobileBudgetToday`. The sheet receives a budget breakdown item + pre-computed pacing result and displays progress, remaining, daily limit, weekly limit, and a link to category transactions. Category rows in `MobileBudgetToday` become tappable with a chevron indicator.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, vaul (via shadcn Drawer), lucide-react icons, date-fns

---

### Task 1: Create BudgetCategorySheet component

**Files:**
- Create: `components/dashboard/BudgetCategorySheet.tsx`

- [ ] **Step 1: Create the component file**

```tsx
'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { type BudgetBreakdownItem } from './MobileBudgetToday'
import type { PacingResult } from '@/lib/finance-utils'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

type Props = {
  item: BudgetBreakdownItem
  pace: PacingResult
  isPrivacyMode?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetCategorySheet({ item, pace, isPrivacyMode, open, onOpenChange }: Props) {
  const weeklyAllowance = pace.dailyLimit * 7

  const dataRows = [
    { label: 'Sisa Budget', value: item.remaining, color: 'text-foreground' },
    { label: 'Anggaran', value: item.limit, color: 'text-muted-foreground' },
    { label: 'Terpakai', value: item.spent, color: 'text-destructive' },
  ] as const

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[70dvh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{item.categoryName}</DrawerTitle>
        </DrawerHeader>
        <div className="px-5 pb-6 space-y-5 overflow-y-auto">
          {/* Header + progress */}
          <div className="space-y-2">
            <p className="text-base font-bold">{item.categoryName}</p>
            <Progress value={pace.spendProgress} className="h-2.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pace.spendProgress.toFixed(0)}% terpakai</span>
              <span>{pace.daysRemaining} hari tersisa</span>
            </div>
          </div>

          {/* Data rows: Sisa, Anggaran, Terpakai */}
          <div className="space-y-2">
            {dataRows.map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className={cn('text-sm font-semibold tabular-nums', row.color)}>
                  {formatCurrency(row.value, { isPrivacyMode })}
                </span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Pacing: Daily, Weekly, Days remaining */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-tighter">Pacing</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Harian</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(pace.dailyLimit, { isPrivacyMode })}
                <span className="text-xs text-muted-foreground font-normal"> /hari</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mingguan</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(weeklyAllowance, { isPrivacyMode })}
                <span className="text-xs text-muted-foreground font-normal"> /minggu</span>
              </span>
            </div>
          </div>

          {/* Link to transactions */}
          <Link
            href={`/transactions?categoryId=${item.categoryId}`}
            className="flex items-center justify-center gap-1.5 text-sm text-primary font-medium underline underline-offset-2"
            onClick={() => onOpenChange(false)}
          >
            Lihat transaksi {item.categoryName}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
```

- [ ] **Step 2: Export BudgetBreakdownItem type from MobileBudgetToday**

Open `components/dashboard/MobileBudgetToday.tsx` and find the `BudgetBreakdownItem` type definition at lines 13-25. Add `export` to the type so `BudgetCategorySheet` can import it:

```typescript
export type BudgetBreakdownItem = {
```

- [ ] **Step 3: Run typecheck to verify no errors**

```bash
npx tsc --noEmit --pretty
```

Expected: No errors. BudgetCategorySheet compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/BudgetCategorySheet.tsx
git commit -m "feat: create BudgetCategorySheet component"
```

---

### Task 2: Wire sheet into MobileBudgetToday

**Files:**
- Modify: `components/dashboard/MobileBudgetToday.tsx`

- [ ] **Step 1: Import BudgetCategorySheet and icons**

Add at the top of the file, alongside existing imports:

```tsx
import { BudgetCategorySheet } from './BudgetCategorySheet'
import { ChevronRight } from 'lucide-react'
```

The `ChevronDown` and `ChevronRight` are already imported from lucide-react in line 10 — change the import to include `ChevronRight` (it may already be there from the `ChevronDown, ChevronRight` import on line 10 — check and add if missing).

- [ ] **Step 2: Add sheet state variables**

Inside the `MobileBudgetToday` component function, after the existing state at line 103:

```tsx
const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
```

- [ ] **Step 3: Compute `pacedItemsMap` for lookups**

After the existing `pacedItems` computation around line 130-132, add a Map for O(1) lookups:

```tsx
const pacedItemsMap = new Map(pacedItems.map(item => [item.categoryId, item]))
```

- [ ] **Step 4: Find selected item and its pace**

Add after the map:

```tsx
const selectedItem = selectedCategoryId
  ? (summary?.budgetBreakdown?.find(i => i.categoryId === selectedCategoryId) ?? null)
  : null
const selectedPace = selectedCategoryId ? (pacedItemsMap.get(selectedCategoryId)?.pace ?? null) : null
```

- [ ] **Step 5: Make category rows tappable**

Locate the danger/warning items loop around line 174 and add `onClick` + `ChevronRight` to each row. Replace the current content from the `{dangerItems.map(...)}` block through the `{showSafe && safeItems.map(...)}` block.

Replace lines 174-189 (danger/warning items mapping):

```tsx
const renderCategoryRow = (item: typeof pacedItems[number]) => (
  <button
    key={item.categoryId}
    type="button"
    onClick={() => setSelectedCategoryId(item.categoryId)}
    className="flex items-center justify-between gap-2 w-full text-left"
  >
    <span className="text-xs truncate min-w-0 flex-1">{item.categoryName}</span>
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-20 h-2 bg-muted-foreground/20 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', getPaceBarColor(item.pace.status))}
          style={{ width: `${Math.min(100, item.pace.spendProgress)}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums shrink-0 w-[68px] text-right">
        {formatCurrency(item.pace.dailyLimit, { isPrivacyMode })}
      </span>
      <span className="text-xs text-muted-foreground">/hari</span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  </button>
)
```

Then update the danger/warning/safe rendering sections. Replace the block from line 174 to line 215:

```tsx
{[...dangerItems, ...warningItems].map(renderCategoryRow)}
{safeItems.length > 0 && (
  <Button
    variant="ghost"
    className="w-full text-xs text-muted-foreground h-9 justify-start px-2 hover:bg-muted/50"
    onClick={() => setShowSafe(!showSafe)}
  >
    {showSafe ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
    {showSafe ? 'Hide on track budgets' : `${safeItems.length} other budget${safeItems.length > 1 ? 's' : ''} on track`}
  </Button>
)}
{showSafe && safeItems.map(renderCategoryRow)}
```

- [ ] **Step 6: Add the BudgetCategorySheet at the end of the card**

After the closing `</div>` of "Today's spending" section (around line 247) and before the closing `</CardContent>` tag, add:

```tsx
{selectedItem && selectedPace && (
  <BudgetCategorySheet
    item={selectedItem}
    pace={selectedPace}
    isPrivacyMode={isPrivacyMode}
    open={selectedCategoryId !== null}
    onOpenChange={(open) => {
      if (!open) setSelectedCategoryId(null)
    }}
  />
)}
```

- [ ] **Step 7: Verify the full file compiles**

```bash
npx tsc --noEmit --pretty
```

Expected: No type errors.

- [ ] **Step 8: Run lint**

```bash
npm run lint
```

Expected: No lint errors. If there are lint issues, fix them. Common issues might be unused imports or missing hooks deps — adjust as needed.

- [ ] **Step 9: Commit**

```bash
git add components/dashboard/MobileBudgetToday.tsx
git commit -m "feat: wire BudgetCategorySheet into MobileBudgetToday"
```

---

### Task 3: Manual verification

**Files:** None — run the dev server and test manually.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual test checklist**

On mobile viewport (narrow the browser or use devtools):

1. Navigate to dashboard
2. Verify "Budget Today" card renders with all category rows as before
3. Verify each category row now has a small `>` chevron at the end
4. Tap a category row — bottom sheet opens with:
   - Category name
   - Progress bar with percentage
   - Sisa Budget, Anggaran, Terpakai amounts
   - Pacing section with Harian, Mingguan, Sisa hari
   - "Lihat transaksi" link
5. Verify weekly = daily × 7 (rough check: if daily is Rp30rb, weekly should be Rp210rb)
6. Swipe down on sheet — dismisses
7. Tap outside sheet (scrim) — dismisses
8. Tap a different category — old sheet closes, new one opens for correct category
9. Verify "Lihat transaksi" navigates to `/transactions?categoryId=xxx`
10. Toggle privacy mode — all amounts should be masked in the sheet

- [ ] **Step 3: Fix any issues found during testing**

If issues found, fix them inline and re-test.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address manual testing feedback"
```

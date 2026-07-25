# Remove Auto-Rollover + Add Re-process Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove automatic rollover processing from page load. Make the month-end wizard the single source of truth. Add a "Re-process" button for users who add transactions to already-processed periods.

**Architecture:** Remove `ensureCurrentRollover` useEffect from budgets page. Add Re-process button that detects unprocessed periods with transactions. Modify month-end page to handle `?reprocess=true` query param. Update snapshot storage to overwrite existing records.

**Tech Stack:** Next.js 16 (App Router), React 19, Convex, Tailwind CSS v4

---

## File Structure

| File | Change |
|------|--------|
| `app/budgets/page.tsx` | Remove `ensureCurrentRollover` useEffect + Add Re-process button |
| `app/budgets/month-end/page.tsx` | Handle `?reprocess=true` query param → start at Step 4 |
| `convex/monthEndSnapshots.ts` | Update `saveSnapshotInternal` to overwrite existing snapshot |
| `docs/CACHE_OPTIMIZATION.md` | Remove `ensureCurrentRollover` reference |
| `docs/changes-log.md` | Add entry for this change |

---

## Task 1: Remove `ensureCurrentRollover` from page load

**Files:**
- Modify: `app/budgets/page.tsx:125-133`

- [ ] **Step 1: Remove the useEffect that calls ensureCurrentRollover**

```typescript
// REMOVE this entire block (lines 125-133):
const rolloverInitRef = useRef(false)

useEffect(() => {
  if (activeHousehold && !rolloverInitRef.current) {
    rolloverInitRef.current = true
    ensureCurrentRollover({ householdId: householdId ?? undefined })
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [activeHousehold])
```

Also remove `ensureCurrentRollover` from the import statement at the top of the file.

- [ ] **Step 2: Verify build passes**

Run: `npm run build --webpack`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add app/budgets/page.tsx
git commit -m "feat: remove automatic rollover from page load"
```

---

## Task 2: Add Re-process button on budgets page

**Files:**
- Modify: `app/budgets/page.tsx`

- [ ] **Step 1: Add logic to detect unprocessed periods**

After the existing budget calculations (around line 175), add:

```typescript
// Detect periods that have transactions but no rollover/sweep
const processedPeriods = useMemo(() => {
  if (!budgetData?.data) return new Set<string>()
  return new Set(
    budgetData.data
      .filter(b => b.type === 'rollover' || b.type === 'sweep')
      .map(b => `${b.month}-${b.year}`)
  )
}, [budgetData?.data])

const hasUnprocessedPeriods = useMemo(() => {
  // Check if current period has been processed
  const currentPeriodKey = `${fiscalMonth}-${fiscalYear}`
  return !processedPeriods.has(currentPeriodKey) && budgetData?.data && budgetData.data.length > 0
}, [processedPeriods, fiscalMonth, fiscalYear, budgetData?.data])
```

- [ ] **Step 2: Add Re-process button UI**

After the existing Month-End Review button (around line 436), add:

```typescript
{/* Re-process button - only show when current period not processed but has data */}
{hasUnprocessedPeriods && (
  <motion.div
    variants={fadeInUp}
    initial="hidden"
    animate="visible"
    className="mb-6"
  >
    <button
      onClick={() => router.push(`/budgets/month-end?reprocess=true&month=${fiscalMonth}&year=${fiscalYear}`)}
      className="w-full p-3 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-amber-500/10 hover:from-amber-500/10 hover:to-amber-500/15 transition-all group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <RefreshCw className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-amber-500">Re-process Rollover</p>
            <p className="text-[10px] text-amber-500/70">
              Transactions were added to a processed period. Update your rollover to reflect changes.
            </p>
          </div>
        </div>
        <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
          <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      </div>
    </button>
  </motion.div>
)}
```

- [ ] **Step 3: Add RefreshCw import**

Add to the import statement at the top of the file:

```typescript
import { RefreshCw } from 'lucide-react'
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build --webpack`
Expected: Build succeeds without errors

- [ ] **Step 5: Commit**

```bash
git add app/budgets/page.tsx
git commit -m "feat: add re-process button for unprocessed periods"
```

---

## Task 3: Handle reprocess query param in month-end page

**Files:**
- Modify: `app/budgets/month-end/page.tsx`

- [ ] **Step 1: Add useSearchParams and detect reprocess mode**

At the top of the file, add import:

```typescript
import { useSearchParams } from 'next/navigation'
```

Inside the component, add:

```typescript
const searchParams = useSearchParams()
const isReprocess = searchParams.get('reprocess') === 'true'
const reprocessMonth = parseInt(searchParams.get('month') || '-1')
const reprocessYear = parseInt(searchParams.get('year') || '-1')
```

- [ ] **Step 2: Start at Step 4 if reprocess mode**

Change the initial step calculation:

```typescript
const [currentStep, setCurrentStep] = useState(isReprocess ? 4 : 1)
```

- [ ] **Step 3: Skip steps 1-3 navigation in reprocess mode**

In the step navigation logic, prevent going back to steps 1-3 when in reprocess mode:

```typescript
const goToStep = (step: number) => {
  if (isReprocess && step < 4) return // Can't go back to steps 1-3 in reprocess mode
  setDirection(step > currentStep ? 1 : -1)
  setCurrentStep(step)
}
```

- [ ] **Step 4: Use reprocess month/year if provided**

Modify the budget data query to use reprocess params when available:

```typescript
const targetMonth = isReprocess ? reprocessMonth : prevMonth
const targetYear = isReprocess ? reprocessYear : prevYear

const budgetData = useQuery(convexApi.budgets.getBudgetStatus, {
  month: targetMonth,
  year: targetYear,
  householdId: householdId ?? undefined
})
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build --webpack`
Expected: Build succeeds without errors

- [ ] **Step 6: Commit**

```bash
git add app/budgets/month-end/page.tsx
git commit -m "feat: handle reprocess query param in month-end page"
```

---

## Task 4: Update snapshot storage to overwrite

**Files:**
- Modify: `convex/monthEndSnapshots.ts`

- [ ] **Step 1: Update saveSnapshotInternal to overwrite existing**

Find the `saveSnapshotInternal` function and modify it to check for existing snapshot:

```typescript
export async function saveSnapshotInternal(
  ctx: MutationCtx,
  args: {
    userId: string
    householdId: string | undefined
    month: number
    year: number
    sweptBudgets: Array<{ budgetId: Id<'budgets'>; previousSweptAmount: number }>
    rolledOverBudgets: Array<{ budgetId: Id<'budgets'>; previousCarryoverAmount: number }>
    insertedBudgetIds: Id<'budgets'>[]
  }
) {
  // Check for existing snapshot
  const existing = await ctx.db
    .query("monthEndSnapshots")
    .withIndex("by_userId_householdId_month_year", (q) =>
      q
        .eq("userId", args.userId)
        .eq("householdId", args.householdId ?? "")
        .eq("month", args.month)
        .eq("year", args.year)
    )
    .unique()

  if (existing) {
    // Overwrite existing snapshot
    await ctx.db.patch(existing._id, {
      sweptBudgets: args.sweptBudgets,
      rolledOverBudgets: args.rolledOverBudgets,
      insertedBudgetIds: args.insertedBudgetIds,
      createdAt: Date.now()
    })
    return existing._id
  } else {
    // Create new snapshot
    return await ctx.db.insert("monthEndSnapshots", {
      userId: args.userId,
      householdId: args.householdId ?? "",
      month: args.month,
      year: args.year,
      sweptBudgets: args.sweptBudgets,
      rolledOverBudgets: args.rolledOverBudgets,
      insertedBudgetIds: args.insertedBudgetIds,
      createdAt: Date.now()
    })
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build --webpack`
Expected: Build succeeds without errors

- [ ] **Step 3: Commit**

```bash
git add convex/monthEndSnapshots.ts
git commit -m "feat: overwrite existing snapshot on re-process"
```

---

## Task 5: Update documentation

**Files:**
- Modify: `docs/CACHE_OPTIMIZATION.md`
- Modify: `docs/changes-log.md`

- [ ] **Step 1: Remove ensureCurrentRollover from CACHE_OPTIMIZATION.md**

Find and remove the line mentioning `ensureCurrentRollover` from the mutations list in `convex/budgets.ts`.

- [ ] **Step 2: Add entry to changes-log.md**

Add a new entry at the top of the changes log:

```markdown
## 2026-07-25

### Remove Auto-Rollover + Add Re-process Button
- Removed `ensureCurrentRollover` from page load - wizard is now the single source of truth
- Added "Re-process Rollover" button on budgets page for unprocessed periods
- Month-end page handles `?reprocess=true` query param to start at Step 4
- Snapshot storage now overwrites existing records instead of creating duplicates
- Users have full control over when month-end processing occurs
```

- [ ] **Step 3: Commit**

```bash
git add docs/CACHE_OPTIMIZATION.md docs/changes-log.md
git commit -m "docs: update for remove auto-rollover feature"
```

---

## Verification

After completing all tasks:

1. Run `npm run build --webpack` to verify no build errors
2. Test the flow:
   - Navigate to budgets page
   - Verify no automatic rollover happens
   - Add a transaction for current period
   - Verify Re-process button appears (if applicable)
   - Click Re-process button → verify redirect to month-end page with Step 4
   - Process month-end → verify snapshot is saved
   - Click Undo → verify rollback works
   - Re-process again → verify snapshot is overwritten (not duplicated)

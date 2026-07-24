# Fix handleSweep Month Calculation + Atomic Month-End Processing

## Problem

### Issue #1: Wrong Month in `handleSweep`

`handleSweep` in `app/budgets/page.tsx:158` uses `selectedDate` (the date the user is viewing in the UI) to calculate which month to process:

```typescript
const { year: sweepYear, month: sweepMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);
```

But `getMonthEndProposals` query (the source of truth) uses server time (`convex/budgets.ts:461-462`):

```typescript
const now = getServerNow(timezone);
const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
```

If the user navigates to a different month in the UI, `handleSweep` processes the wrong month. Example:

- Today is July 2026 (current fiscal month = July)
- User navigates to May 2026 in the UI
- User clicks "Review & Process"
- `handleSweep` calculates `prevMonth` = April (based on `selectedDate` = May)
- But proposals are for June (the month before July)
- Result: sweep/rollover for June is never processed

### Issue #2: No Atomicity Between Sweep and Rollover

`handleSweep` calls two separate mutations sequentially:

```typescript
const sweptCount = await sweepBudgets({...});    // commits immediately
const rolloverCount = await rolloverBudgets({...}); // can fail independently
```

If `sweepBudgets` succeeds but `rolloverBudgets` fails:
- Sweep is committed (unassigned cash increased)
- Rollover is not committed (carryover to next month lost)
- User sees error toast but state is inconsistent
- Re-clicking "Review & Process" shows no proposals (sweeps already recorded), so rollover can never be processed

## Solution

### 1. New `processMonthEnd` mutation

Create a single mutation in `convex/budgets.ts` that combines sweep and rollover logic within one Convex transaction:

- Auth check (once)
- Sweep logic (extracted from `sweepBudgets`)
- Rollover logic (via existing `performRollover` function)
- `recomputeUserCache` (once)
- Returns `{ sweptCount, rolloverCount }`

Both operations are atomic — if either fails, neither is committed.

### 2. Fix `handleSweep` in `page.tsx`

- Use `currentFiscalDate` (already available at line 115) instead of `selectedDate`
- Call `processMonthEnd` mutation once instead of two separate mutations

## Changes

### `convex/budgets.ts`

- Add `processMonthEnd` mutation (new export)
- Extract sweep logic from `sweepBudgets` into internal `performSweep` function (optional, for readability)
- Existing `sweepBudgets` and `rolloverBudgets` mutations remain unchanged (still available for manual/retry use cases)

### `app/budgets/page.tsx`

- Import `processMonthEnd` from convex API
- Replace `sweepBudgets` and `rolloverBudgets` mutation calls with single `processMonthEnd` call
- Fix date calculation: use `currentFiscalDate` instead of `selectedDate`

## What Does NOT Change

- `getMonthEndProposals` query — already correct
- `MonthEndProcessDialog` component — no changes needed
- `sweepBudgets` mutation — kept for manual use
- `rolloverBudgets` mutation — kept for manual use
- BudgetCard, MoveFundsDrawer, other page functions — unaffected

## Verification

- `npm run lint`
- Manual test: navigate to a past month, verify "Review & Process" still processes the correct (previous) month

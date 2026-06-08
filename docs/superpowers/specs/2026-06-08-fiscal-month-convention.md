# Fiscal Month Convention: End-Month Labeling

> **For agentic workers:** This spec is for the writing-plans skill. After approval, invoke writing-plans and reference this document.

**Goal:** Change fiscal month naming from "start-month" (period named after the month containing `startDay`) to "end-month" (period named after the month containing the end of the range). E.g., period **May 25 – Jun 24** is currently labeled "May" → should be labeled "June".

**Why:** More intuitive — majority of days and the month-end fall in the ending month. User opens app on June 8 and expects to see "June 2026", not "May 2026".

**Architecture:** Update 4 helper functions (2 client, 2 server), run a one-time data migration on `budgets` table, and fix 7 pre-existing calendar-month bugs exposed by the shift.

**Tech Stack:** Next.js, Convex, TypeScript, date-fns

---

## Overview

```
budgetStartDay = 25 (startDay > 1 — period crosses month boundary)

Before (start-month):
  Apr 25 – May 24  →  month=3 (April)
  May 25 – Jun 24  →  month=4 (May)
  Jun 25 – Jul 24  →  month=5 (June)

After (end-month):
  Apr 25 – May 24  →  month=4 (May)
  May 25 – Jun 24  →  month=5 (June)
  Jun 25 – Jul 24  →  month=6 (July)
```

```
budgetStartDay = 1 (startDay === 1 — period fits within one calendar month)

Before & After — no change:
  May 1 – May 31      →  month=4 (May)
  Jun 1 – Jun 30      →  month=5 (June)
```

When `startDay === 1`, the period never crosses a month boundary, so fiscal month = calendar month. The formula must distinguish this case.

### Verification: all startDay values

| startDay | Today   | Old label | New label | Period range          | Correct? |
|----------|---------|-----------|-----------|-----------------------|----------|
| 1        | May 15  | May       | May       | May 1–May 31          | ✓ period within May |
| 1        | Jun 15  | Jun       | Jun       | Jun 1–Jun 30          | ✓ period within Jun |
| 10       | May 8   | Apr       | May       | Apr 10–May 9          | ✓ ends in May |
| 10       | May 12  | May       | Jun       | May 10–Jun 9          | ✓ ends in Jun |
| 15       | Jun 8   | May       | Jun       | May 15–Jun 14         | ✓ ends in Jun |
| 15       | Jun 16  | Jun       | Jul       | Jun 15–Jul 14         | ✓ ends in Jul |
| 25       | Jun 8   | May       | Jun       | May 25–Jun 24         | ✓ ends in Jun |
| 25       | Jun 28  | Jun       | Jul       | Jun 25–Jul 24         | ✓ ends in Jul |

---

## Section A: Helper Functions

### A1. `getFiscalDate` — `lib/finance-utils.ts:15`

**Before:**
```ts
function getFiscalDate(date: Date, startDay: number = 1): Date {
  const day = date.getDate();
  if (day < startDay) return subMonths(date, 1);
  return date;
}
```

**After:**
```ts
function getFiscalDate(date: Date, startDay: number = 1): Date {
  if (startDay === 1) return date; // period fits in one month
  const day = date.getDate();
  if (day >= startDay) return addMonths(date, 1); // period ends next month
  return date;
}
```

Test matrix:

| startDay | Date   | day ? startDay | Result  | Period labeled   | Why |
|----------|--------|----------------|---------|------------------|-----|
| 1        | May 15 | (always)       | May     | May 1–31         | single month |
| 1        | Jun 15 | (always)       | Jun     | Jun 1–30         | single month |
| 10       | May 8  | 8 < 10         | May     | Apr 10–May 9     | ends in May |
| 10       | May 12 | 12 >= 10       | Jun     | May 10–Jun 9     | ends in Jun |
| 25       | Jun 8  | 8 < 25         | Jun     | May 25–Jun 24    | ends in Jun |
| 25       | Jun 28 | 28 >= 25       | Jul     | Jun 25–Jul 24    | ends in Jul |

### A2. `getFiscalMonthRange` — `lib/finance-utils.ts:33`

**Before:**
```ts
function getFiscalMonthRange(year: number, month: number, startDay: number = 1) {
  const startDate = new Date(year, month, startDay);
  const endDate = new Date(year, month + 1, startDay - 1);
  return { start: startDate, end: endDate };
}
```

**After:**
```ts
function getFiscalMonthRange(year: number, month: number, startDay: number = 1) {
  // For label "May" (month=4):
  //   startDay=1  →  May 1 – May 31  (no month shift)
  //   startDay>1  →  Apr 25 – May 24 (start shifts back, end same month as label)
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate   = new Date(year, startDay > 1 ? month : month + 1, startDay - 1);
  return { start: startDate, end: endDate };
}
```

JS Date handles negative/overflow months correctly: `new Date(2026, -1, 25)` = Dec 25, 2025; `new Date(2026, 12, 0)` = Dec 31, 2026.

### A3. `getFiscalDateDetails` — `convex/lib/finance.ts:276`

**Before:**
```ts
export function getFiscalDateDetails(dateStr: string, startDay: number = 1) {
  const date = new Date(dateStr);
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth();
  if (day < startDay) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return { year, month };
}
```

**After:**
```ts
export function getFiscalDateDetails(dateStr: string, startDay: number = 1) {
  const date = new Date(dateStr);
  if (startDay === 1) {
    return { year: date.getFullYear(), month: date.getMonth() };
  }
  const day = date.getDate();
  let year = date.getFullYear();
  let month = date.getMonth();
  if (day >= startDay) {
    month += 1;
    if (month > 11) { month = 0; year += 1; }
  }
  return { year, month };
}
```

Same logic as `getFiscalDate` — no shift when `startDay === 1`.

### A4. `getFiscalMonthRange` — `convex/lib/finance.ts:304`

**Before:**
```ts
export function getFiscalMonthRange(year: number, month: number, startDay: number = 1) {
  const startDate = new Date(year, month, startDay);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear  = month === 11 ? year + 1 : year;
  const endDate   = new Date(nextYear, nextMonth, startDay - 1, 23, 59, 59, 999);
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}
```

**After:**
```ts
export function getFiscalMonthRange(year: number, month: number, startDay: number = 1) {
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate   = new Date(year, startDay > 1 ? month : month + 1, startDay - 1, 23, 59, 59, 999);
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}
```

JS Date handles month overflow natively — no manual wrap logic needed.

---

## Section B: Data Migration

Only budgets belonging to households with `startDay > 1` need migration. startDay=1 budgets already match the new convention (fiscal month = calendar month).

```ts
export const migrateFiscalMonthConvention = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Collect all households with their startDay
    const households = await ctx.db.query("households").collect();
    const householdStartDay = new Map(households.map(h => [h._id, h.budgetStartDay ?? 1]));
    
    // 2. Check each budget's household
    const budgets = await ctx.db.query("budgets").collect();
    let count = 0;
    for (const b of budgets) {
      const startDay = b.householdId ? (householdStartDay.get(b.householdId) ?? 1) : 1;
      if (startDay === 1) continue; // no shift needed

      const newMonth = (b.month + 1) % 12;
      let newYear = b.year;
      if (b.month === 11) newYear += 1;

      if (newMonth !== b.month || newYear !== b.year) {
        await ctx.db.patch(b._id, { month: newMonth, year: newYear });
        count++;
      }
    }
    return { total: budgets.length, updated: count };
  },
});
```

**Run before deploying the helper changes**, so the DB values match the new convention when queries start using the updated helpers.

---

## Section C: Fix Pre-existing Calendar Month Bugs

Every place below uses `now.getMonth()` (calendar month) instead of the fiscal month. These are pre-existing bugs. After migration, budget `month` values shift +1, making these bugs visible.

### C1. `convex/budgets.ts:91` — `getBudgetStatus` fallback

```ts
// Before:
const currentMonth = month ?? now.getMonth();
// After:
const currentMonth = month ?? getFiscalDateDetails(now.toISOString(), startDay).month;
```

Add `import` for `getFiscalDateDetails` (from `./lib/finance`). This import may already exist; check.

### C2. `convex/budgets.ts:1004-1005` — `getBudgetReport` initialization

```ts
// Before:
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
// After:
const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
```

### C3. `convex/categories.ts:83-84, 91-92` — `getGoalDetails` budget query

```ts
// Before:
.eq("year", now.getFullYear())
.eq("month", now.getMonth())
// After:
const { year: fy, month: fm } = getFiscalDateDetails(now.toISOString(), startDay);
// ...
.eq("year", fy)
.eq("month", fm)
```

### C4. `convex/categories.ts:168-169` — `getCategoryDetails` initialization

```ts
// Before:
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
// After:
const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
```

### C5. `convex/categories.ts:392-394` — `categories.get` month query

```ts
// Before:
const year = now.getFullYear();
const month = now.getMonth();
// After:
const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);
```

### C6. `app/budgets/page.tsx:378` — `BudgetDrawer` month prop

```ts
// Before:
year={selectedDate.getFullYear()}
month={selectedDate.getMonth()}
// After:
year={fiscalYear}
month={fiscalMonth}
```

Where `fiscalYear`/`fiscalMonth` come from line 102:
```ts
const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);
```

This ensures budgets created through `BudgetDrawer` use fiscal month, not calendar month.

### C7. `app/budgets/page.tsx:110-111` — manual fiscal range (duplicate helper)

Replace the inline `new Date(fiscalYear, fiscalMonth, budgetStartDay)` / `new Date(fiscalYear, fiscalMonth + 1, budgetStartDay - 1)` with the `getFiscalMonthRange` helper:

```ts
import { getFiscalMonthRange } from '@/lib/finance-utils'; // if not already imported

const { start: cycleStart, end: cycleEnd } = getFiscalMonthRange(fiscalYear, fiscalMonth, budgetStartDay);
```

### C8. `components/BudgetCard.tsx:78` — `calculateBudgetPace` input

```ts
// Before:
calculateBudgetPace(spent, effectiveLimit, selectedDate.getFullYear(), selectedDate.getMonth(), budgetStartDay)
// After:
calculateBudgetPace(spent, effectiveLimit, fiscalYear, fiscalMonth, budgetStartDay)
```

### C9. `app/goals/page.tsx:37-39` — `getBudgetStatus` query

```ts
// Before:
const budgetData = useQuery(api.budgets.getBudgetStatus, {
    month: now.getMonth(),
    year: now.getFullYear(),
    ...
});
// After:
const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(now.toISOString(), budgetStartDay ?? 1);
const budgetData = useQuery(api.budgets.getBudgetStatus, {
    month: fiscalMonth,
    year: fiscalYear,
    ...
});
```

---

## Files Changed (Summary)

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `lib/finance-utils.ts` | 15-22, 33-42 | Helper change |
| 2 | `convex/lib/finance.ts` | 276-295, 304-321 | Helper change |
| 3 | `convex/migrations.ts` | (new migration) | Data migration |
| 4 | `convex/budgets.ts` | 91, 1004-1005 | Calendar→fiscal fix |
| 5 | `convex/categories.ts` | 83-84, 91-92, 168-169, 392-394 | Calendar→fiscal fix |
| 6 | `app/budgets/page.tsx` | 110-111, 378 | Manual range + BudgetDrawer fix |
| 7 | `components/BudgetCard.tsx` | 78 | Calendar→fiscal fix |
| 8 | `app/goals/page.tsx` | 37-39 | Calendar→fiscal fix |

Transparent (helper updates propagate): `convex/dashboard.ts`, `convex/transactions.ts`, `convex/budgets.ts` (most functions), `app/transactions/page.tsx`, `app/categories/[id]/page.tsx`, `components/dashboard/DailyOperationsCard.tsx`

---

## Deployment Order

1. **Run migration** (`migrateFiscalMonthConvention`) on Convex production
2. **Deploy all code changes** (helpers + bug fixes) atomically
3. **Verify** — open budget page, confirm default period shows expected month (June 2026 on June 8 with startDay=25)

No schema changes. No index changes. Only the meaning of stored `month` values shifts for `startDay > 1` households.

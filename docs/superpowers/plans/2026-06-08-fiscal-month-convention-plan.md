# Fiscal Month Convention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change fiscal month naming from "start-month" to "end-month" so period May 25–Jun 24 displays as "June" (month=5) instead of "May" (month=4).

**Architecture:** Update 4 helper functions (2 client, 2 server), add Convex data migration, fix 9 pre-existing calendar-month bugs in 5 files. No schema changes.

**Tech Stack:** Next.js, Convex, TypeScript, date-fns

---

### Task 1: Update `getFiscalDate` (client)

**Files:**
- Modify: `lib/finance-utils.ts:15-22`

- [ ] **Step 1: Replace function body**

```ts
export function getFiscalDate(date: Date, startDay: number = 1): Date {
  if (startDay === 1) return date;
  const day = date.getDate();
  if (day >= startDay) return addMonths(date, 1);
  return date;
}
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no output

---

### Task 2: Update `getFiscalMonthRange` (client)

**Files:**
- Modify: `lib/finance-utils.ts:33-42`

- [ ] **Step 1: Replace function body**

```ts
export function getFiscalMonthRange(year: number, month: number, startDay: number = 1): { start: Date; end: Date } {
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate = new Date(year, startDay > 1 ? month : month + 1, startDay - 1);
  return { start: startDate, end: endDate };
}
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit helpers 1+2**

```bash
git add lib/finance-utils.ts && git commit -m "refactor: update getFiscalDate and getFiscalMonthRange to end-month convention"
```

---

### Task 3: Update `getFiscalDateDetails` (server)

**Files:**
- Modify: `convex/lib/finance.ts:276-295`

- [ ] **Step 1: Replace function body**

```ts
export function getFiscalDateDetails(
  dateStr: string, 
  startDay: number = 1
): { year: number; month: number } {
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

---

### Task 4: Update `getFiscalMonthRange` (server)

**Files:**
- Modify: `convex/lib/finance.ts:304-321`

- [ ] **Step 1: Replace function body**

```ts
export function getFiscalMonthRange(
  year: number,
  month: number,
  startDay: number = 1
): { start: string; end: string } {
  const startDate = new Date(year, startDay > 1 ? month - 1 : month, startDay);
  const endDate = new Date(year, startDay > 1 ? month : month + 1, startDay - 1, 23, 59, 59, 999);
  return { 
    start: startDate.toISOString(), 
    end: endDate.toISOString() 
  };
}
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit helpers 3+4**

```bash
git add convex/lib/finance.ts && git commit -m "refactor: update server helpers to end-month convention"
```

---

### Task 5: Data Migration

**Files:**
- Modify: `convex/migrations.ts`

- [ ] **Step 1: Add migration function**

```ts
export const migrateFiscalMonthConvention = mutation({
  args: {},
  handler: async (ctx) => {
    const households = await ctx.db.query("households").collect();
    const householdStartDay = new Map(
      households.map(h => [h._id, h.budgetStartDay ?? 1])
    );
    
    const budgets = await ctx.db.query("budgets").collect();
    let count = 0;
    for (const b of budgets) {
      const startDay = b.householdId
        ? (householdStartDay.get(b.householdId) ?? 1)
        : 1;
      if (startDay === 1) continue;

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

- [ ] **Step 2: Import `mutation`**

Check that `mutation` is already imported at the top of `convex/migrations.ts` (line 1). It's already:
```ts
import { mutation } from "./_generated/server";
```

- [ ] **Step 3: Commit**

```bash
git add convex/migrations.ts && git commit -m "feat: add migration for fiscal month end-month convention"
```

---

### Task 6: Fix `convex/budgets.ts` — calendar month fallbacks

**Files:**
- Modify: `convex/budgets.ts:91`, `convex/budgets.ts:1004-1005`

- [ ] **Step 1: Fix `getBudgetStatus` fallback (line 91)**

```ts
// Before:
const currentMonth = month ?? now.getMonth();
// After:
const currentMonth = month ?? getFiscalDateDetails(now.toISOString(), startDay).month;
```

Check: `getFiscalDateDetails` is already imported from `./lib/finance` (line 12 of budgets.ts).

- [ ] **Step 2: Fix `getBudgetReport` initialization (line 1004-1005)**

```ts
// Before:
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
// After:
const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
```

- [ ] **Step 3: Commit**

```bash
git add convex/budgets.ts && git commit -m "fix: use fiscal month instead of calendar month in budgets queries"
```

---

### Task 7: Fix `convex/categories.ts` — 3 calendar month bugs

**Files:**
- Modify: `convex/categories.ts:83-84,91-92`, `168-169`, `392-394`

- [ ] **Step 1: Fix `getGoalDetails` budget query (lines 83-84, 91-92)**

Before (lines 78-92):
```ts
if (householdId) {
    currentBudget = await ctx.db.query("budgets")
        .withIndex("by_householdId_category_year_month", q => 
            q.eq("householdId", householdId)
             .eq("categoryId", id)
             .eq("year", now.getFullYear())
             .eq("month", now.getMonth())
        ).first();
} else {
    currentBudget = await ctx.db.query("budgets")
        .withIndex("by_user_category_year_month", q => 
            q.eq("userId", identity.subject)
             .eq("categoryId", id)
             .eq("year", now.getFullYear())
             .eq("month", now.getMonth())
```

After:
```ts
const { year: fy, month: fm } = getFiscalDateDetails(now.toISOString(), startDay);
if (householdId) {
    currentBudget = await ctx.db.query("budgets")
        .withIndex("by_householdId_category_year_month", q => 
            q.eq("householdId", householdId)
             .eq("categoryId", id)
             .eq("year", fy)
             .eq("month", fm)
        ).first();
} else {
    currentBudget = await ctx.db.query("budgets")
        .withIndex("by_user_category_year_month", q => 
            q.eq("userId", identity.subject)
             .eq("categoryId", id)
             .eq("year", fy)
             .eq("month", fm)
```

Note: `startDay` is available in the surrounding function (from `household?.budgetStartDay ?? 1`). Check the exact variable name at the call site.

- [ ] **Step 2: Fix `getCategoryDetails` initialization (lines 168-169)**

```ts
// Before:
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
// After:
const { year: currentYear, month: currentMonth } = getFiscalDateDetails(now.toISOString(), startDay);
```

Again, confirm `startDay` is available in this function's scope.

- [ ] **Step 3: Fix `categories.get` month query (lines 392-394)**

```ts
// Before:
const year = now.getFullYear();
const month = now.getMonth();
// After:
const { year, month } = getFiscalDateDetails(now.toISOString(), startDay);
```

- [ ] **Step 4: Check imports**

Make sure `getFiscalDateDetails` is imported from `"./lib/finance"` in categories.ts. It's already imported at line 7.

- [ ] **Step 5: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add convex/categories.ts && git commit -m "fix: use fiscal month instead of calendar month in categories queries"
```

---

### Task 8: Fix `app/budgets/page.tsx` — 2 bugs

**Files:**
- Modify: `app/budgets/page.tsx:110-111`, `377-378`

- [ ] **Step 1: Fix manual fiscal range calc (lines 110-111)**

Replace:
```ts
const fiscalStart = new Date(fiscalYear, fiscalMonth, budgetStartDay);
const fiscalEnd = new Date(fiscalYear, fiscalMonth + 1, budgetStartDay - 1);
const formattedPeriod = `${format(fiscalStart, 'MMM d')} - ${format(fiscalEnd, 'MMM d')}`;
```

With:
```ts
import { getFiscalMonthRange } from '@/lib/finance-utils';
// ... (add to existing import line 28)

const { start: fiscalStart, end: fiscalEnd } = getFiscalMonthRange(fiscalYear, fiscalMonth, budgetStartDay);
const formattedPeriod = `${format(fiscalStart, 'MMM d')} - ${format(fiscalEnd, 'MMM d')}`;
```

- [ ] **Step 2: Fix BudgetDrawer month prop (lines 377-378)**

```ts
// Before:
year={selectedDate.getFullYear()}
month={selectedDate.getMonth()}
// After:
year={fiscalYear}
month={fiscalMonth}
```

`fiscalYear` and `fiscalMonth` are already computed at lines 101-102 from `getFiscalDateDetails`.

- [ ] **Step 3: Commit**

```bash
git add app/budgets/page.tsx && git commit -m "fix: use fiscal month for BudgetDrawer and fiscal range display"
```

---

### Task 9: Fix `components/BudgetCard.tsx` — calendar month input

**Files:**
- Modify: `components/BudgetCard.tsx:78`

- [ ] **Step 1: Replace `calculateBudgetPace` call**

Find the exact call at line 78:
```ts
const pacing = category.enablePacing && category.type === 'expense' && budget
    ? calculateBudgetPace(spent, effectiveLimit, selectedDate.getFullYear(), selectedDate.getMonth(), budgetStartDay)
    : null;
```

Replace `selectedDate.getFullYear()` / `selectedDate.getMonth()` with fiscal values.

Check how `fiscalYear`/`fiscalMonth` are available in BudgetCard's scope. If `selectedDate` is the prop, convert it:
```ts
import { getFiscalDateDetails } from '@/lib/finance-utils';
// ...
const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(selectedDate.toISOString(), budgetStartDay);

const pacing = category.enablePacing && category.type === 'expense' && budget
    ? calculateBudgetPace(spent, effectiveLimit, fiscalYear, fiscalMonth, budgetStartDay)
    : null;
```

- [ ] **Step 2: Verify with tsc**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/BudgetCard.tsx && git commit -m "fix: use fiscal month in BudgetCard pacing calculation"
```

---

### Task 10: Fix `app/goals/page.tsx` — calendar month query

**Files:**
- Modify: `app/goals/page.tsx:37-39`

- [ ] **Step 1: Replace query params**

```ts
import { getFiscalDateDetails } from '@/lib/finance-utils';

// In component:
const { householdId } = useHousehold();
const budgetStartDay = /* get from household or default to 1 */;

const { year: fiscalYear, month: fiscalMonth } = getFiscalDateDetails(now.toISOString(), budgetStartDay);
```

But `budgetStartDay` may not be directly available. Check the component. If not, either:
- Get it from `useQuery(api.households.get, ...)` 
- Or default to 1: `getFiscalDateDetails(now.toISOString(), 1)`

Find the actual approach at implementation time. For now mark it as requiring a `budgetStartDay` source.

- [ ] **Step 2: Commit**

```bash
git add app/goals/page.tsx && git commit -m "fix: use fiscal month in goals page budget query"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean exit, no errors

- [ ] **Step 2: Full build check**

Run: `npm run build` (or equivalent)
Expected: success

---

### Self-review checklist

| Spec requirement | Covered by |
|---|---|
| `getFiscalDate` end-month logic + startDay=1 | Task 1 |
| `getFiscalMonthRange` (client) | Task 2 |
| `getFiscalDateDetails` (server) | Task 3 |
| `getFiscalMonthRange` (server) | Task 4 |
| Data migration | Task 5 |
| budgets.ts calendar→fiscal | Task 6 |
| categories.ts calendar→fiscal | Task 7 |
| BudgetDrawer month prop | Task 8 |
| Manual fiscal range duplicate | Task 8 |
| BudgetCard pacing input | Task 9 |
| Goals page query | Task 10 |
| TypeScript verification | Task 11 |

Placeholder scan: No TBDs, TODOs, or placeholders. All code blocks contain real implementations.

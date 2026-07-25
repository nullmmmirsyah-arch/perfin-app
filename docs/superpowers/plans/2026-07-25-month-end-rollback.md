# Month-End Rollback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ability to undo the last month-end process by restoring budget fields to their previous state.

**Architecture:** Snapshot approach — save budget state before `processMonthEnd`, restore on `rollbackMonthEnd`. Single `monthEndSnapshots` table stores previous values. Banner on budgets page provides undo UI.

**Tech Stack:** Convex (schema + mutations), Next.js (page UI), shadcn/ui (AlertDialog)

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `convex/schema.ts` | Modify | Add `monthEndSnapshots` table |
| `convex/monthEndSnapshots.ts` | Create | Queries/mutations for snapshot CRUD |
| `convex/budgets.ts` | Modify | Save snapshot in `processMonthEnd` |
| `app/budgets/page.tsx` | Modify | Add undo banner + confirmation dialog |

---

### Task 1: Add `monthEndSnapshots` table to schema

**Files:**
- Modify: `convex/schema.ts:273`

- [ ] **Step 1: Add table definition**

```typescript
// Add before the closing `});` of defineSchema
monthEndSnapshots: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
    sweptBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousSweptAmount: v.string(),
    })),
    rolledOverBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousCarryoverAmount: v.string(),
    })),
    insertedBudgets: v.array(v.id("budgets")),
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"])
    .index("by_userId_year_month", ["userId", "year", "month"]),
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "schema: add monthEndSnapshots table"
```

---

### Task 2: Create `convex/monthEndSnapshots.ts` module

**Files:**
- Create: `convex/monthEndSnapshots.ts`

- [ ] **Step 1: Create file with imports and types**

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getHousehold, ensureHouseholdAccess } from "./lib/helpers";

export type MonthEndSnapshot = {
  _id: any;
  userId: string;
  householdId?: any;
  month: number;
  year: number;
  sweptBudgets: { budgetId: any; previousSweptAmount: string }[];
  rolledOverBudgets: { budgetId: any; previousCarryoverAmount: string }[];
  insertedBudgets: any[];
  createdAt: string;
};
```

- [ ] **Step 2: Add `getLatest` query**

```typescript
export const getLatest = query({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    let snapshots;
    if (householdId) {
      snapshots = await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
        .order("desc")
        .first();
    } else {
      snapshots = await ctx.db
        .query("monthEndSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
    }
    return snapshots;
  },
});
```

- [ ] **Step 3: Add `save` mutation**

```typescript
export const save = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    month: v.number(),
    year: v.number(),
    sweptBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousSweptAmount: v.string(),
    })),
    rolledOverBudgets: v.array(v.object({
      budgetId: v.id("budgets"),
      previousCarryoverAmount: v.string(),
    })),
    insertedBudgets: v.array(v.id("budgets")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Delete existing snapshot for this month (overwrite if exists)
    const existing = args.householdId
      ? await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_householdId_year_month", (q) =>
            q.eq("householdId", args.householdId!).eq("year", args.year).eq("month", args.month)
          )
          .first()
      : await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_userId_year_month", (q) =>
            q.eq("userId", userId).eq("year", args.year).eq("month", args.month)
          )
          .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await ctx.db.insert("monthEndSnapshots", {
      userId,
      householdId: args.householdId,
      month: args.month,
      year: args.year,
      sweptBudgets: args.sweptBudgets,
      rolledOverBudgets: args.rolledOverBudgets,
      insertedBudgets: args.insertedBudgets,
      createdAt: new Date().toISOString(),
    });
  },
});
```

- [ ] **Step 4: Add `rollback` mutation**

```typescript
export const rollback = mutation({
  args: {
    householdId: v.optional(v.id("households")),
  },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject;

    // Find latest snapshot
    const snapshot = householdId
      ? await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_householdId", (q) => q.eq("householdId", householdId))
          .order("desc")
          .first()
      : await ctx.db
          .query("monthEndSnapshots")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .order("desc")
          .first();

    if (!snapshot) {
      throw new Error("No rollback available");
    }

    // Restore swept budgets
    for (const { budgetId, previousSweptAmount } of snapshot.sweptBudgets) {
      await ctx.db.patch(budgetId, { sweptAmount: previousSweptAmount });
    }

    // Restore rolled over budgets
    for (const { budgetId, previousCarryoverAmount } of snapshot.rolledOverBudgets) {
      await ctx.db.patch(budgetId, { carryoverAmount: previousCarryoverAmount });
    }

    // Delete inserted budgets
    for (const budgetId of snapshot.insertedBudgets) {
      await ctx.db.delete(budgetId);
    }

    // Delete snapshot
    await ctx.db.delete(snapshot._id);

    // Recompute cache
    const { recomputeUserCache } = await import("./lib/recomputeCache");
    await recomputeUserCache(ctx, userId, householdId);

    return { rolledBack: true };
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add convex/monthEndSnapshots.ts
git commit -m "feat: add monthEndSnapshots module with getLatest, save, rollback"
```

---

### Task 3: Modify `processMonthEnd` to save snapshot

**Files:**
- Modify: `convex/budgets.ts` (processMonthEnd handler, ~line 1016-1162)

- [ ] **Step 1: Add snapshot arrays before sweep logic**

Inside `processMonthEnd` handler, after line 1070 (`const spendingByCategory = ...`), before the sweep loop:

```typescript
    // Snapshot arrays for rollback
    const sweptSnapshot: { budgetId: typeof budgets[number]["_id"]; previousSweptAmount: string }[] = [];
    const rolloverSnapshot: { budgetId: typeof budgets[number]["_id"]; previousCarryoverAmount: string }[] = [];
```

- [ ] **Step 2: Capture previous values before sweep patch**

In the sweep loop (line 1092), before `ctx.db.patch`:

```typescript
      if (remaining > 0 && Math.abs(remaining - currentSwept) > 0.01) {
        sweptSnapshot.push({ budgetId: budget._id, previousSweptAmount: budget.sweptAmount ?? "0" });
        await ctx.db.patch(budget._id, { sweptAmount: remaining.toString() });
        sweptCount++;
      }
```

- [ ] **Step 3: Capture previous values before rollover patch**

In the rollover loop (line 1140-1155), before `ctx.db.patch` and `ctx.db.insert`:

```typescript
        if (targetBudget) {
          const targetCarryover = parseFloat(targetBudget.carryoverAmount?.replace(/,/g, '') || '0');
          if (Math.abs(targetCarryover - sisa) > 0.01) {
            rolloverSnapshot.push({ budgetId: targetBudget._id, previousCarryoverAmount: targetBudget.carryoverAmount ?? "0" });
            await ctx.db.patch(targetBudget._id, { carryoverAmount: sisa.toString() });
            rolloverCount++;
          }
        } else {
          const newBudget = await ctx.db.insert("budgets", {
            userId,
            householdId,
            categoryId: b.categoryId,
            amount: "0",
            year: targetYear,
            month: targetMonth,
            carryoverAmount: sisa.toString()
          });
          rolloverSnapshot.push({ budgetId: newBudget, previousCarryoverAmount: "0" });
          rolloverCount++;
        }
```

- [ ] **Step 4: Save snapshot after rollover, before recomputeUserCache**

After line 1159 (end of rollover loop), before `await recomputeUserCache`:

```typescript
    // Save snapshot for rollback
    if (sweptSnapshot.length > 0 || rolloverSnapshot.length > 0) {
      const { save: saveSnapshot } = await import("./monthEndSnapshots");
      await saveSnapshot(ctx, {
        householdId: householdId ?? undefined,
        month,
        year,
        sweptBudgets: sweptSnapshot,
        rolledOverBudgets: rolloverSnapshot,
        insertedBudgets: rolloverSnapshot
          .filter(r => r.previousCarryoverAmount === "0")
          .map(r => r.budgetId),
      });
    }
```

- [ ] **Step 5: Build test**

```bash
npm run build --webpack 2>&1 | Select-Object -First 30
```

- [ ] **Step 6: Commit**

```bash
git add convex/budgets.ts
git commit -m "feat: save snapshot in processMonthEnd for rollback"
```

---

### Task 4: Add undo banner to budgets page

**Files:**
- Modify: `app/budgets/page.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { useQuery, useMutation } from 'convex/react'
import { api as convexApi } from '../../convex/_generated/api'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Add query and mutation**

Inside the component, after existing queries:

```typescript
  const latestSnapshot = useQuery(convexApi.monthEndSnapshots.getLatest, {
    householdId: householdId ?? undefined
  })
  const rollbackMonthEnd = useMutation(convexApi.monthEndSnapshots.rollback)
  const [showRollbackDialog, setShowRollbackDialog] = useState(false)
  const [isRollingBack, setIsRollingBack] = useState(false)
```

- [ ] **Step 3: Add rollback handler**

```typescript
  const handleRollback = async () => {
    setIsRollingBack(true)
    try {
      await rollbackMonthEnd({ householdId: householdId ?? undefined })
      toast.success('Month-end process undone')
      setShowRollbackDialog(false)
    } catch (error) {
      toast.error('Failed to undo: ' + (error as Error).message)
    } finally {
      setIsRollingBack(false)
    }
  }
```

- [ ] **Step 4: Add banner UI (after header, before main content)**

```tsx
      {/* Rollback Banner */}
      {latestSnapshot && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-lg mb-4">
          <p className="text-xs text-muted-foreground">
            ↩ Month-end processed for {latestSnapshot.month + 1}/{latestSnapshot.year}
          </p>
          <button
            onClick={() => setShowRollbackDialog(true)}
            className="text-xs text-destructive hover:text-destructive/80 font-medium"
          >
            Undo last process
          </button>
        </div>
      )}

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo Month-End Process</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will reverse the last month-end process:</p>
              {latestSnapshot?.sweptBudgets && latestSnapshot.sweptBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.sweptBudgets.length} categories will have swept amounts reset
                </p>
              )}
              {latestSnapshot?.rolledOverBudgets && latestSnapshot.rolledOverBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.rolledOverBudgets.length} categories will have carryover amounts restored
                </p>
              )}
              {latestSnapshot?.insertedBudgets && latestSnapshot.insertedBudgets.length > 0 && (
                <p className="text-sm">
                  • {latestSnapshot.insertedBudgets.length} budgets created during rollover will be deleted
                </p>
              )}
              <p className="text-destructive font-medium text-sm pt-2">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack}
              className={cn(
                buttonVariants(),
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isRollingBack ? 'Undoing...' : 'Undo Process'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

- [ ] **Step 5: Build test**

```bash
npm run build --webpack 2>&1 | Select-Object -First 30
```

- [ ] **Step 6: Commit**

```bash
git add app/budgets/page.tsx
git commit -m "feat: add undo banner on budgets page for month-end rollback"
```

---

### Task 5: Final verification

- [ ] **Step 1: Full build**

```bash
npm run build --webpack
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Commit all changes**

```bash
git add -A
git commit -m "feat: month-end rollback mechanism complete"
```

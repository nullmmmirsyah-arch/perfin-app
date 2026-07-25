# Remove Auto-Rollover + Add Re-process Button

**Date:** 2026-07-25
**Status:** Approved
**Author:** AI Assistant

## Problem

`ensureCurrentRollover` runs automatically on budgets page load, creating rollover budgets for the previous fiscal period without user action. This makes the month-end wizard redundant because rollover is already done before the user opens the wizard.

## Goal

Remove automatic rollover processing. Make the month-end wizard the single source of truth for processing period transitions. Add a "Re-process" button for users who add transactions to already-processed periods.

## Design

### 1. Remove `ensureCurrentRollover` from page load

**File:** `app/budgets/page.tsx`

Remove the `useEffect` that calls `ensureCurrentRollover` (lines 127-146). No automatic processing on page load.

### 2. Re-process button on budgets page

**Trigger:** Detect periods that have been processed (rollover/sweep budgets exist) but have new transactions added afterward.

**Logic:**
- Compare processed periods (budgets with type `rollover` or `sweep`) against periods with transactions
- If a period has transactions but was processed before those transactions existed, show Re-process button

**UI:** Same design as "Month-End Review" button (gradient, icon, chevron, hover animation), with:
- **Label:** "Re-process Rollover"
- **Description:** "Transactions were added to a processed period. Update your rollover to reflect changes."
- **Response:** Redirect to `/budgets/month-end?reprocess=true&month=X&year=Y`

### 3. Re-process flow in month-end page

**Route:** `/budgets/month-end?reprocess=true&month=6&year=2026`

**Behavior:**
- Wizard starts at Step 4 directly (skip Steps 1-3)
- Shows existing rollover/sweep data for the period
- User can modify actions (toggle/swap) before submit
- Submit updates existing rollover/sweep budgets + saves snapshot (overwrite)

### 4. Undo banner behavior

**Same as current:** Banner shows "Period X/Y has been processed. Undo last process" with rollback button.

**Rollback:** Restores state to before the snapshot was saved.

### 5. Snapshot storage (overwrite)

**Table:** `monthEndSnapshots`

**Logic:** `saveSnapshotInternal` checks for existing snapshot with same user/household/month/year. If exists, overwrite. If not, create new.

```javascript
const existing = await ctx.db
  .query("monthEndSnapshots")
  .withIndex("by_userId_householdId_month_year", q => 
    q.eq("userId", userId)
     .eq("householdId", householdId)
     .eq("month", month)
     .eq("year", year)
  )
  .unique();

if (existing) {
  await ctx.db.patch(existing._id, { sweptBudgets, rolledOverBudgets, ... });
} else {
  await ctx.db.insert("monthEndSnapshots", { ... });
}
```

### 6. Cache impact

No cache issues. `processMonthEnd` (wizard) also calls `recomputeUserCache`. Cache stays fresh when user runs wizard. Only timing changes: before = page load, after = wizard execution.

## Files to modify

| File | Change |
|------|--------|
| `app/budgets/page.tsx` | Remove `ensureCurrentRollover` useEffect + Add Re-process button |
| `app/budgets/month-end/page.tsx` | Handle `?reprocess=true` query param → start at Step 4 |
| `convex/monthEndSnapshots.ts` | Update `saveSnapshotInternal` to overwrite existing snapshot |
| `docs/CACHE_OPTIMIZATION.md` | Remove `ensureCurrentRollover` reference |
| `docs/changes-log.md` | Add entry for this change |

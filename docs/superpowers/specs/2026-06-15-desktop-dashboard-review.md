# Desktop Dashboard Review — Fixes & Enhancements

**Date:** 2026-06-15
**Scope:** Bug fixes and UX improvements to the existing desktop dashboard layout
**Approach:** Quick Fix — minimal structural changes, component-local fixes

## Group 1 (P1 — Critical)

### 1.1 QuickAdjust Empty State
- **Problem:** `QuickAdjust` renders an empty card with placeholder text when `items.length === 0`, wasting grid space.
- **Fix:** Return `null` from `QuickAdjust` when no budget items exist. Add conditional render in `app/dashboard/page.tsx`.
- **Files:** `components/dashboard/QuickAdjust.tsx`, `app/dashboard/page.tsx`

### 1.2 Privacy Mode on TransactionListGrouped
- **Problem:** `TransactionListGrouped` (desktop recent transactions) does not accept or apply `isPrivacyMode`, exposing amounts when privacy mode is active.
- **Fix:** Add `isPrivacyMode` prop to `TransactionListGrouped`. Update its local `formatCurrency` to use the shared `formatCurrency` from `lib/utils` with privacy support. Pass prop from dashboard page.
- **Files:** `components/transactions/TransactionListGrouped.tsx`, `app/dashboard/page.tsx`

## Group 2 (P2 — High Priority)

### 2.2 TrendChart Month Range Control
- **Problem:** TrendChart always shows 3 months with no way to change the range.
- **Fix:** Add a `ViewToggle`-style button group (3mo | 6mo | 12mo) in the card header. Use `useState(3)` for the selected range. Pass `months` argument to `getMonthlyTrends` query.
- **Files:** `components/dashboard/TrendChart.tsx`

### 2.3 DailyOperationsCard Visual Hierarchy
- **Problem:** All budget categories appear in a flat list — no grouping or visual prioritization beyond urgency sorting.
- **Fix:** Group categories into three sections:
  - **Over Budget** (always visible, red background/icon)
  - **Watch** (pacing warning, always visible, yellow)
  - **On Track** (collapsible, default collapsed if > 3 items, shows count badge)
  - Sorting within each group remains by urgency score.
- **Files:** `components/dashboard/DailyOperationsCard.tsx`

### 2.5 RecurringSummary Mark Paid Inline
- **Problem:** Desktop recurring bills are view-only. Mobile has inline mark-paid buttons.
- **Fix:** Add a small "Mark Paid" button next to each unpaid/overdue item in the recurring list. Use `useMutation(api.recurring.markRecurringPaid)`. Follow existing pattern from `MobileRecurringRow`. Show loading spinner and toast feedback.
- **Files:** `components/dashboard/RecurringSummary.tsx`

## Group 3 (P3 — Medium Priority)

### 3.1 Loading States per Component
- **Problem:** Generic skeleton cards don't indicate which component is loading.
- **Fix:** Create component-specific skeletons in `components/skeletons.tsx`:
  - `DailyOperationsCardSkeleton` — card with 3 tab placeholders + 3 progress rows
  - `TrendChartSkeleton` — card with 3 fake bar chart bars
  - `MonthlyComparisonSkeleton` — card with big number + 3 category rows
  - `RecurringSummarySkeleton` — small card with 2 text lines
  - `QuickAdjustSkeleton` — card with 2 slider placeholders
  - Update `app/dashboard/page.tsx` to render specific skeletons per slot.
- **Files:** `components/skeletons.tsx`, `app/dashboard/page.tsx`

### 3.2 Error States
- **Problem:** Failed queries show indefinite loading skeletons — no error feedback.
- **Fix:** Add error state handling per component. Pattern:
  - `data === undefined` → loading skeleton (existing)
  - `data === null` → error state with message + retry button
  - Convex returns `null` on query error
  - Create reusable `ErrorState` component (based on shadcn `EmptyState` with retry action).
- **Files:** New `components/ui/error-state.tsx`, update all 6 dashboard components.

### 3.4 Cross-Component Interaction
- **Problem:** No interaction between dashboard components — clicking a category navigates away instead of highlighting related data.
- **Fix:** Use custom DOM events (same proven pattern as `PERFIN_SETTLE_RECEIVABLE`):
  - Clicking a category row in `DailyOperationsCard` dispatches `PERFIN_FILTER_CATEGORY` with `categoryId`
  - `TrendChart` and `MonthlyComparison` listen for the event and highlight/filter relevant data
  - Clicking again toggles the filter off
  - Event-driven to avoid prop drilling across sibling components.
- **Files:** `components/dashboard/DailyOperationsCard.tsx`, `components/dashboard/TrendChart.tsx`, `components/dashboard/MonthlyComparison.tsx`

### 3.5 MonthlyComparison Custom Period
- **Problem:** Only compares current month vs last month — limited insight.
- **Fix:** Add a `ViewToggle` in the card header: **vs Last Month** | **vs Avg (3mo)**. In avg mode, fetch 4 months of data, compute average of months 2-4, compare with month 1 (current). Use same visual format (percentage change + top 3 category changes).
- **Files:** `components/dashboard/MonthlyComparison.tsx`

## Files Changed Summary

| File | Changes |
|------|---------|
| `app/dashboard/page.tsx` | Conditional QuickAdjust render, pass isPrivacyMode to TransactionListGrouped, specific skeletons |
| `components/dashboard/QuickAdjust.tsx` | Return null when no items |
| `components/transactions/TransactionListGrouped.tsx` | Add isPrivacyMode prop, use shared formatCurrency |
| `components/dashboard/TrendChart.tsx` | Month range toggle, cross-component event listener, highlight logic |
| `components/dashboard/DailyOperationsCard.tsx` | Category grouping (Over/Watch/On Track), dispatch filter event |
| `components/dashboard/RecurringSummary.tsx` | Mark Paid button, markRecurringPaid mutation |
| `components/dashboard/MonthlyComparison.tsx` | Mode toggle (last month / avg 3mo), event listener |
| `components/skeletons.tsx` | 5 new component-specific skeletons |
| `components/ui/error-state.tsx` | New ErrorState component |

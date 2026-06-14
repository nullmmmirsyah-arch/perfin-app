# Mobile Dashboard Restructure

**Date:** 2026-06-14
**Status:** Approved

## Problem

The mobile dashboard stacks 7+ identically-styled `Card` components vertically, causing:

1. **Excessive scrolling** — users must scroll past multiple cards to find key metrics like total balance
2. **Redundant information** — DailyGuidance, BudgetSummary, TodaySpending, and BudgetAttentionList all display overlapping budget-pacing data
3. **Weak visual hierarchy** — all cards use the same `Card` shell with equal padding, radius, and shadow, making it hard to distinguish primary vs secondary information
4. **Key metrics hidden behind taps** — total balance/liquid cash is only visible after tapping the "Balance" tab in `MobileDashboardTabs`
5. **Recurring Bills** occupies a full card despite being low-density information (often 1-2 overdue items)
6. **Bottom navigation** uses only 3 of 5 available slots; 6 additional routes (Goals, Accounts, Categories, Labels, Reports, Recurring) are hidden behind a "More" drawer, adding friction for frequently-accessed pages

## Approach

**Option B: Restructure** (chosen over Light Polish and Full Redesign)

Consolidate redundant cards, bring primary metrics to the top, optimize BottomNav to 5 visible items, and reduce visual noise — all while reusing existing components and data queries.

## Layout (top to bottom)

### 1. Hero Summary
A gradient card pinned at the top showing:
- **Total Balance** (liquid cash, from `summary.liquidCash`)
- **Budget Left** (from `summary.remainingBudget`)
- **Daily Allowance** (remaining budget / fiscal days remaining)
- **Fiscal Day** badge ("Day 12/30")

No existing component matches this — new component: `components/dashboard/MobileHeroSummary.tsx`.

### 2. Budget Today (consolidation)
Merge DailyGuidance, BudgetSummary, TodaySpending, and BudgetAttentionList into one card with clear sections:
- **Status badge** (On Track / Spending Faster / Slow Down, reused from DailyGuidance)
- **Overall progress bar** (budget used so far, reused from BudgetSummary)
- **Per-category daily allowance** (new) — a compact list showing each budget category with:
  - Category name + icon
  - Mini progress bar (daily spending vs daily limit)
  - Remaining daily amount
  - Sorted: danger items first → warning → safe (collapsed by default)
- **Today's expenses** (compact list, reused from TodaySpending, max 5 items)

This replaces: `DailyGuidance`, `BudgetSummary`, `TodaySpending`, `BudgetAttentionList` on mobile.
New component: `components/dashboard/MobileBudgetToday.tsx`.

### 3. Tabs: Balance | Lent | Goals (refined)
Same three tabs as `MobileDashboardTabs.tsx`, but:
- **Values shown on tab buttons** — each tab button displays the total value (e.g., "Rp5.000.000") alongside the label, so users see the number without tapping
- Active tab gets filled background, inactive tabs outlined

Modify existing `MobileDashboardTabs.tsx` or create `components/dashboard/MobileOverviewTabs.tsx`.

### 4. Recurring Bills (compact row)
Replace full `Card` with a compact row:
- **Header row**: label + total + count badges (paid/unpaid/overdue)
- **Inline action**: overdue items shown directly with a "Bayar" button calling `api.recurring.markRecurringPaid`
- Expandable to show all upcoming items

New component: `components/dashboard/MobileRecurringRow.tsx`.

### 5. Recent Transactions
Unchanged from current implementation.

### 6. Bottom Navigation
Expand from 3 visible items + More drawer to **5 visible items**:

| # | Item | Icon | Route |
|---|------|------|-------|
| 1 | Home | `LayoutDashboard` | `/dashboard` |
| 2 | Trans | `ArrowLeftRight` | `/transactions` |
| 3 | Budgets | `PiggyBank` | `/budgets` |
| 4 | Goals | `Target` | `/goals` |
| 5 | Reports | `FileBarChart` | `/report` |

The "More" drawer is removed from BottomNav.

Modify `components/BottomNav.tsx`.

## Data Flow

All data is already fetched via `api.dashboard.getDashboardSummary` in `app/dashboard/page.tsx`. No new queries are needed — the restructure only reorganizes how existing data is presented.

The `markRecurringPaid` mutation already exists in `convex/recurring.ts`.

## Components to Create/Modify

### New
| Component | Purpose |
|-----------|---------|
| `components/dashboard/MobileHeroSummary.tsx` | Gradient hero with balance, budget, allowance |
| `components/dashboard/MobileBudgetToday.tsx` | Consolidated budget card with per-category daily allowance |
| `components/dashboard/MobileRecurringRow.tsx` | Compact recurring row with inline "Bayar" |

### Modified
| Component | Change |
|-----------|--------|
| `components/dashboard/MobileDashboardTabs.tsx` | Show values on tab buttons |
| `components/BottomNav.tsx` | 5 visible items: Home, Trans, Budgets, Goals, Reports |

### Removed from mobile path
| Component | Replaced by |
|-----------|-------------|
| `DailyGuidance` | Absorbed into `MobileBudgetToday` |
| `BudgetSummary` | Absorbed into `MobileBudgetToday` |
| `TodaySpending` | Absorbed into `MobileBudgetToday` |
| `BudgetAttentionList` | Absorbed into `MobileBudgetToday` |
| `RecurringSummary` (as full Card) | `MobileRecurringRow` |

## State Changes

| File | Change |
|------|--------|
| `app/dashboard/page.tsx` | Replace mobile section imports; remove 4 unused components from mobile render path |

## Design System

No new design tokens needed. Uses existing Tailwind `primary`, `success`, `warning`, `destructive` semantic colors plus `gradient` utilities.

## Implementation Order

1. `MobileHeroSummary.tsx` — standalone, no dependencies
2. `MobileBudgetToday.tsx` — absorbs 4 existing components
3. `MobileRecurringRow.tsx` — standalone, calls existing mutation
4. Update `MobileDashboardTabs.tsx` — add values to tab buttons
5. Update `BottomNav.tsx` — 5 visible items
6. Update `app/dashboard/page.tsx` — wire new components, remove old ones

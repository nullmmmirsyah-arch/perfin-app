# Month-End Experience Page Design

## Overview

Replace the current dialog-based "Review & Process" with an immersive, step-by-step page experience at `/budgets/month-end`. Designed to make month-end review feel rewarding and motivating through subtle animations and psychological touches.

## Current State (Production)

- Banner "Review & Process" → navigates to `/budgets/month-end`
- 4-step wizard page with animations
- Per-category health status, insights, achievements
- Celebration with confetti on completion
- Per-category toggle (include/exclude) and type swap (sweep ↔ rollover) in Step 4

## Route

- **URL:** `/budgets/month-end`
- **Entry:** Banner in budgets page
- **Exit:** Back button → `/budgets`

## Step Structure

### Step 1: Month Summary
- Animated counters: total spent, total saved, savings rate
- Health score (0-100) with animated progress ring
- Fade-in animation (200ms)

### Step 2: Category Review
- Expenses and Goals sections stacked vertically (no tabs)
- Per-category cards with health status:
  - On-track (green) — "Great job!"
  - Warning (yellow) — "Getting close"
  - Overspent (red) — "Over budget"
- Savings: more saved = better (inverted logic)
- Staggered card entrance (fade + slide-up, 50ms delay)

### Step 3: Insights & Tips
- Month-over-month comparison (real data from `lastMonthData`)
- Spending tips per category (derived from `categoryHealth`)
- Achievement cards: "Budget Master", "Smart Saver", "Perfect Streak"

### Step 4: Confirm & Process
- Per-category toggle (include/exclude from processing)
- Type swap per category (sweep ↔ rollover)
- Negative amounts (overspent) shown in red (`destructive`)
- Real-time summary updates as user toggles
- Empty state: "All Caught Up!" when no proposals
- Calls `processMonthEnd` mutation with `actions` parameter

## Data Flow

```
/budgets/month-end
  ├── useQuery(getBudgetStatus, { month: prevMonth }) → budgetData
  │     ├── Steps 1-3: totalSpent, totalSaved, categoryHealth, tips, achievements
  │     └── useMemo → proposals (derived client-side)
  │           ├── sweep: !enablePacing && sisa > 0
  │           └── rollover: enablePacing && sisa !== 0 (with dedup check)
  ├── useQuery(getBudgetStatus, { month: currentFiscalMonth }) → currentBudgetData
  │     └── Rollover dedup: skip if carryoverAmount already matches sisa
  ├── useQuery(getBudgetStatus, { month: twoMonthsAgo }) → lastMonthData
  │     └── Step 3: month comparison
  └── Step 4: processMonthEnd({ month, year, householdId, actions })
```

### Proposal Derivation (Client-Side)

Proposals are derived from `budgetData.data` using `useMemo`, NOT from a separate server query:

```typescript
const proposals = useMemo(() => {
  for (const item of budgetData.data) {
    const sisa = (allocated + carryover - swept) - spent
    if (!enablePacing && sisa > 0) → sweep
    if (enablePacing && sisa !== 0 && !alreadyProcessed) → rollover
  }
}, [budgetData, currentBudgetData])
```

This ensures:
- Same data source as Steps 1-3 (consistency)
- No timezone/date mismatch between client and server
- One fewer query

## Motion Design

- Step transitions: fade + slide-up (200ms)
- Cards: staggered entrance
- Counters: animated number counting
- Health score: progress ring animation
- Celebration: subtle confetti burst

## Files

### Created Files
- `app/budgets/month-end/page.tsx` — route page
- `components/budgets/month-end/MonthSummaryStep.tsx`
- `components/budgets/month-end/CategoryReviewStep.tsx`
- `components/budgets/month-end/InsightsStep.tsx`
- `components/budgets/month-end/ConfirmStep.tsx`
- `components/budgets/month-end/StepIndicator.tsx`

### Modified Files
- `app/budgets/page.tsx` — banner condition, dynamic text, dead code removed
- `convex/budgets.ts` — `processMonthEnd` accepts optional `actions` parameter

### Deleted Files
- `components/MonthEndProcessDialog.tsx` — replaced by `/budgets/month-end` page

## Existing Code Reuse

- `formatCurrency` — amount formatting
- `getFiscalDateDetails` from `@/lib/finance-utils` — fiscal month calculation
- `canvas-confetti` — celebration
- `motion` from framer-motion — animations

# Month-End Experience Page Design

## Overview

Replace the current dialog-based "Review & Process" with an immersive, step-by-step page experience at `/budgets/month-end`. Designed to make month-end review feel rewarding and motivating through subtle animations and psychological touches.

## Current State

- Banner "Review & Process" → opens `MonthEndProcessDialog` (single dialog)
- Dialog shows summary + confirm button
- No insights, no celebration, no engagement

## Target State

- Banner "Review & Process" → navigates to `/budgets/month-end`
- 4-step wizard page with subtle animations
- Per-category health status, insights, achievements
- Celebration with confetti on completion

## Testing Mode (Temporary)

- Add unconditional "Month-End Experience" button for testing
- Step 4 does NOT execute `processMonthEnd` — only shows "Done!" message
- Route accessible without proposals for testing

## Route

- **URL:** `/budgets/month-end`
- **Entry:** Banner in budgets page + test button
- **Exit:** Back button → `/budgets`

## Step Structure

### Step 1: Month Summary
- Animated counters: total spent, total saved, savings rate
- Health score (0-100) with animated progress ring
- Fade-in animation (200ms)

### Step 2: Category Review
- Per-category cards with health status:
  - On-track (green) — "Great job!"
  - Warning (yellow) — "Getting close"
  - Overspent (red) — "Over budget"
- Staggered card entrance (fade + slide-up, 50ms delay)

### Step 3: Insights & Tips
- Month-over-month comparison
- Spending tips per category
- Achievement cards: "Top Saver", "Budget Master", "Streak Keeper"

### Step 4: Confirm (Testing Mode)
- Summary: "X categories to sweep, Y to roll over"
- Confirm button → "Done! (Testing mode)"
- "Back to Budgets" button

## Motion Design

- Step transitions: fade + slide-up (200ms)
- Cards: staggered entrance
- Counters: animated number counting
- Health score: progress ring animation
- Celebration: subtle confetti burst

## Files to Create/Modify

### New Files
- `app/budgets/month-end/page.tsx` — route page
- `components/budgets/month-end/MonthSummaryStep.tsx`
- `components/budgets/month-end/CategoryReviewStep.tsx`
- `components/budgets/month-end/InsightsStep.tsx`
- `components/budgets/month-end/ConfirmStep.tsx`
- `components/budgets/month-end/StepIndicator.tsx`

### Modified Files
- `app/budgets/page.tsx` — add test button + update banner onClick

## Data Flow

```
/budgets/month-end
  ├── useQuery(getMonthEndProposals) → proposals
  ├── useQuery(getBudgetStatus) → budget data for insights
  └── Step 4: no mutation call (testing mode)
```

## Existing Code Reuse

- `formatCurrency` — amount formatting
- `calculateBudgetPace` — health status
- `GoalWizardStepIndicator` — step indicator (adapt)
- `canvas-confetti` — celebration
- `motion` from framer-motion — animations

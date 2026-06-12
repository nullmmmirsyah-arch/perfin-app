# Dashboard v2: Decision Support & Coach Redesign

## Vision
Transform dashboard from a monitoring tool (showing data) into a Decision Support Dashboard with Coach Ringan (MVP) and Coach Adaptif (long-term) capabilities.

## Coaching Levels

| Level | Description | Timeline |
|-------|-------------|----------|
| **B. Coach Ringan (MVP)** | Insight + historical context + positive reinforcement | Phase 1-4 |
| **D. Coach Adaptif (Long-term)** | Behavior-aware adaptive coaching | Post-MVP |

## Architecture

### Approach: Modular (selected)
Each section is an independent component. Mobile and Desktop have completely different layouts. Components are composed in `app/dashboard/page.tsx`.

### Component Tree

```
app/dashboard/page.tsx
├── DashboardLayout (responsive wrapper)
├── DailyGuidance              [NEW]
│   ├── OverallStatus
│   ├── DailyRecommendation
│   └── HistoricalContext
├── DashboardSections
│   ├── BudgetSummary           [REFINED]
│   ├── BudgetAttentionList     [REFINED]
│   │   └── BudgetAttentionItem
│   ├── TodaySpending           [NEW]
│   ├── RecentTransactions      [EXISTING, compact]
│   ├── BalanceSummary          [REFINED from Cash tab]
│   └── LentSummary             [REFINED]
├── [Desktop only]
│   ├── TrendChart              [NEW]
│   ├── MonthlyComparison       [NEW]
│   ├── WhatIfSimulator         [NEW]
│   ├── BudgetQuickEdit         [NEW]
│   └── CalendarView            [FUTURE]
├── WealthCard                  [EXISTING]
└── TransactionDrawer, Dialogs  [EXISTING]
```

## Mobile Layout (Daily Decision View)

Single scrollable vertical layout (no carousel). Priority order:

1. **DailyGuidance** — overall status badge + daily spend recommendation + historical context
2. **BudgetSummary** — remaining budget + days remaining + progress bar
3. **TodaySpending** — today's transactions list + allowance used progress bar
4. **BudgetAttentionList** — only Danger/Warning budgets visible, Safe collapsed under "▶ X other budgets on track". Criteria: `danger` (over budget or >10% ahead) and `warning` (ahead of schedule) shown; `safe` collapsed.
5. **Balance | Lent | Goals** — tabbed card, swipeable/switchable

Balance shows aggregated total with drill-down per account. Lent shows total owed with quick actions. Goals shows progress bars.

## Desktop Layout (Planning Mode)

Two-column grid layout:

- **Top row (full width):** Compact DailyGuidance + BudgetSummary side by side
- **Left column:** BudgetAttentionList (full) + BalanceSummary + LentSummary
- **Right column:** TrendChart (3-month bar chart), WhatIfSimulator (budget sliders), BudgetQuickEdit
- **Bottom row:** RecentTransactions + WealthCard/Goals

Desktop planning tools:
- **A. Trend & Review** — monthly spending comparison (this month vs last month vs 3-month trend)
- **B. What-If Scenarios** — slider-based budget adjustment with real-time impact calculation
- **C. Budget Management** — quick inline edit or link to full `/budgets` page
- **D. Calendar View** — future phase

## Live Spend Feedback

Daily recommendation (`remainingBudget / daysRemaining`) recalculates with every transaction:
- Spend below → next day's limit increases (positive reinforcement)
- Spend above → next day's limit decreases (natural correction)
- Display: "Rp75k spent today · Rp62k remaining for today" + "If you keep this pace: Rp47k/day from tomorrow"

## Phases

### Phase 1: Foundation
- Rename "Cash" tab → "Balance"
- Update "Total Liquid Cash" → "Total Balance"
- Replace pacing dots (h-2 w-2 animated) with text badges ("On Track" / "Watch" / "Too Fast")
- Update copy to decision-first language: "Spend up to RpX today" not "~RpX/day"
- Add "X days remaining" to Budget Left display
- Update both `DailyOperationsCard.tsx` and `BudgetCard.tsx`
- **Files:** `DailyOperationsCard.tsx`, `BudgetCard.tsx`, `finance-utils.ts`
- **Safe to push:** cosmetic only, no layout changes

### Phase 2: Mobile Daily View
- Create new components: `DailyGuidance`, `BudgetSummary`, `BudgetAttentionList`, `TodaySpending`, `BalanceSummary`, `LentSummary`
- Restructure `app/dashboard/page.tsx` for mobile: remove carousel, use vertical scroll
- Desktop still uses existing `DailyOperationsCard` + `WealthCard` (unchanged)
- Data from existing Convex query (`getDashboardSummary`)
- **Files:** new components in `components/dashboard/`, modify `app/dashboard/page.tsx`
- **Safe to push:** only mobile layout changes; desktop unchanged

### Phase 3: Desktop Planning & Desktop Layout
- Create: `TrendChart`, `MonthlyComparison`, `WhatIfSimulator`, `BudgetQuickEdit`
- New Convex query: `getMonthlyTrends` for historical spending data
- Restructure desktop layout to 2-column: daily ops (left) + planning (right)
- **Files:** new components, new Convex query, `app/dashboard/page.tsx` desktop section
- **Safe to push:** desktop-only changes; mobile from Phase 2 unchanged

### Phase 4: Polish + Coach Ringan Layer
- Celebration messages ("Great job!", "You're doing great on Transport!")
- Historical context in DailyGuidance ("Last week: 8% less than planned")
- Transition animations
- Empty state fallback copy (for users with no budgets)
- Any remaining copy refinements
- **Safe to push:** additive, no structural changes

## Empty States

- **No budgets set:** DailyGuidance shows "Set up your first budget to get daily guidance" with link to `/budgets`. AttentionList shows empty state with CTA. BudgetSummary shows Rp0 with hint.
- **No transactions today:** TodaySpending shows "No spending yet today. You have RpX to spend." with positive tone.
- **No accounts:** BalanceSummary shows "Add an account to track your balance" with link to `/accounts`.
- **No receivables:** LentSummary shows compact "No active receivables" text only.

## Technical Notes

- **Live feedback:** No polling needed. Convex `useQuery` auto-updates when mutations (transactions) are committed. Components re-render with new daily allowance automatically.
- **Status aggregation for DailyGuidance:** Computed client-side from `budgetBreakdown` array. Rule: if any budget is `danger` → overall "Slow down"; if any is `warning` → "Spending faster"; all `safe` → "On track". The specific budget name in the danger/warning is mentioned in the guidance text.
- **Historical context ("Last week"):** Computed client-side from `recentTransactions` by comparing current week's spending to previous week's. Phase 4 concern.

## Data Requirements

### Existing (no changes needed)
- `api.dashboard.getDashboardSummary` — remaining budget, budget breakdown, pending receivables, cash accounts
- `calculateBudgetPace()` — per-category pacing status
- `calculateFiscalDaysRemaining()` — days remaining in fiscal month

### New (Phase 3)
- `api.dashboard.getMonthlyTrends` — monthly aggregated spending per category for trend charts
  - Input: householdId, month range (current month - 3)
  - Output: array of { month, year, totalSpent, categories: { categoryId, categoryName, spent, limit } }

## Key Design Decisions

1. **Modular architecture:** Each section is independent, testable, and can be composed differently for mobile vs desktop
2. **Mobile-first but not mobile-only:** Mobile optimized for daily decisions; Desktop adds planning tools
3. **No backend changes in Phase 1-2:** Leverage existing Convex data; new query only needed for Phase 3 trends
4. **Live spend feedback:** Daily recommendation is dynamic, not static; updates with each transaction
5. **Attention criteria:** Only `danger` and `warning` status budgets shown; `safe` collapsed
6. **Coaching tone:** Positive reinforcement ("Great!") before warnings ("Food needs attention")

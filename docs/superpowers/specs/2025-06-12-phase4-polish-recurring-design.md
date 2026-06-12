# Phase 4: Polish + Recurring Expenses

## Overview

Phase 4 consists of three sub-projects executed in order:

1. **4a: Empty States + Animations** — polish dashboard UX
2. **4c: Recurring Expenses** — recurring bill tracking
3. **4b: Coach AI** — hybrid rule-based + Gemini insights (future)

---

## 4a: Empty States

### Goal

Replace all inline `<div>...teks...</div>` empty/loading states with a consistent reusable `<EmptyState>` component.

### Component: `<EmptyState>`

```tsx
type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
};
```

- **icon**: Lucide icon, rendered 48x48 in muted color
- **title**: Short bold heading (optional)
- **description**: Main message, text-muted-foreground
- **action**: Optional CTA button (Link if href, Button if onClick)
- **compact**: `true` = smaller padding/icon, for inside cards with limited space

**Layout (non-compact):**
```
┌──────────────────────────┐
│                          │
│         [icon]           │
│   [title]                │
│   [description]          │
│                          │
│   [action button →]      │
│                          │
└──────────────────────────┘
```

### Components to Update (10 total)

| Component | Condition | Icon | Title | Description | Action |
|-----------|-----------|------|-------|-------------|--------|
| **QuickAdjust** | `!summary \|\| items.length === 0` | `Wallet` | "No budgets yet" | "Set up budgets to see real-time what-if scenarios and adjust your spending." | { href: "/budgets", label: "Create Budget" } |
| **MonthlyComparison** | `trends === undefined` | `BarChart3` | "Loading..." | (skeleton pulse) | — |
| **MonthlyComparison** | `trends.length < 2` | `BarChart3` | "Not enough data" | "Comparison will appear once you have at least 2 months of spending data." | — |
| **TrendChart** | `trends === undefined` | `TrendingUp` | "Loading..." | (skeleton pulse) | — |
| **TrendChart** | `trends.length === 0` | `TrendingUp` | "No spending trends yet" | "Your spending trends will appear here once you have transactions." | — |
| **TodaySpending** | `todayTxns.length === 0` | `Receipt` | "No spending yet today" | "You have {dailyAllowance} to spend today." | { onClick: openAddTransaction, label: "Add Transaction" } |
| **DailyGuidance** | `!hasBudgets` | `Compass` | "No guidance yet" | "Set up your first budget to get daily spending guidance." | { href: "/budgets", label: "Go to Budgets" } |
| **BudgetAttentionList** | `no items at all` | `ListChecks` | "No budgets" | "No budgets set. Create one to start tracking." | { href: "/budgets", label: "Create Budget" } |
| **BudgetAttentionList** | `all safe` | `CheckCircle2` | "All on track!" | "All budgets are within pace. Great job!" | — |
| **BalanceSummary** | `accounts.length === 0` | `PiggyBank` | "No accounts" | "Add an account to track your balance." | { href: "/accounts", label: "Add Account" } |
| **LentSummary** | `receivables.length === 0` | `HandCoins` | "No active receivables" | "Money you lend to others will appear here." | — |
| **GoalSummary** | `goals.length === 0` | `Target` | "No goals set" | "Create a savings goal to track your progress." | { href: "/goals", label: "Create Goal" } |
| **DailyOperationsCard** | (per-tab) | Per-tab icon | Per-tab title | Per-tab description | Per-tab CTA |

### Loading States

Loading state variants use the same `<EmptyState>` but with:
- Skeleton pulse animation on icon + text
- Title = "Loading..."
- No action button

### File

```
components/ui/empty-state.tsx     [NEW]
  → EmptyState component
```

---

## 4a: Animations

### Goal

Smooth, lightweight animations without excessive motion.

### Approach

Use CSS animations + `framer-motion` (add dependency) for:

1. **Card mount**: Cards fade in + translateY(20px) → 0 on dashboard load, staggered (100ms delay between cards)
2. **Number animation**: Animated counters for currency values (QuickAdjust impact section, BalanceSummary)
3. **Skeleton pulse**: Smoother pulse via CSS `@keyframes`

### Dependency

```
npm install framer-motion
```

### Components to Update

| Component | Animation |
|-----------|-----------|
| **Dashboard page** | `motion.div` wrapper per card with `fadeInUp` variant, staggered |
| **QuickAdjust** | Animate impact numbers (total budget, daily allowance) on slider change |
| **BalanceSummary** | Animate balance number on load |
| **All skeletons** | Replace existing pulse with CSS `@keyframes shimmer` |

### Implementation Notes

- Use `motion.div` with `initial`, `animate`, `exit` props
- Define shared variants in a constants file
- Respect `prefers-reduced-motion` via `useReducedMotion` hook

### File

```
lib/animations.ts                [NEW]
  → Shared framer-motion variants (fadeInUp, staggerContainer, scaleIn)
components/dashboard/DashboardAnimations.tsx  [NEW]
  → Optional wrapper component
```

---

## 4c: Recurring Expenses

### Goal

Allow users to track recurring monthly bills (rent, subscriptions, utilities) and mark them as paid each month.

### Data Layer

#### Convex Table: `recurringExpenses`

```
{
  _id: Id<"recurringExpenses">,
  userId: string,
  householdId?: Id<"households">,
  name: string,                    // "Listrik", "Netflix", etc.
  amount: string,                  // stored as string with commas, same convention as transactions
  categoryId: Id<"categories">,
  dayOfMonth: number,              // 1-31
  isActive: boolean,               // soft delete
  createdAt: number,
}
```

#### Convex Table: `recurringPayments`

```
{
  _id: Id<"recurringPayments">,
  recurringExpenseId: Id<"recurringExpenses">,
  year: number,
  month: number,                   // 1-12
  paidAt: number,                  // timestamp when marked as paid
  transactionId?: Id<"transactions">, // optional, set when paid via prefilled form
}
```

### Backend

#### Queries

- `getRecurringExpenses(householdId?)` — all active recurring expenses
- `getRecurringSummary(householdId?, year, month)` — total due, paid, upcoming for dashboard

#### Mutations

- `createRecurringExpense(name, amount, categoryId, dayOfMonth, householdId?)`
- `updateRecurringExpense(id, name?, amount?, categoryId?, dayOfMonth?)`
- `deleteRecurringExpense(id)` — sets isActive = false
- `markRecurringPaid(recurringExpenseId, year, month)` — inserts `recurringPayments` row, opens TransactionDrawer prefilled

### Pages

#### `/recurring` (new route)

- List of all active recurring expenses
- Each row: name | amount | day | category | status this month (paid/unpaid/overdue)
- Add button → inline form or dialog
- Edit/delete per row
- [Bayar] button → marks as paid + opens TransactionDrawer with prefilled amount & category

### Dashboard Integration

#### Desktop layout

New card in the right column (below TrendChart/MonthlyComparison) or in left column:

```
┌─ Recurring Bills ─────────────────┐
│                                    │
│  Total this month: Rp 1.200.000    │
│  2 paid · 1 unpaid · 0 overdue    │
│                                    │
│  📌 Internet — due tomorrow       │
│  🔴 Listrik — overdue 3 days      │
│  ✅ Netflix — paid on 5 Jun       │
│                                    │
│  [View All →]                      │
└────────────────────────────────────┘
```

#### Mobile layout

Simplified reminder in the mobile tab area or as a compact card:
```
📌 1 bill due tomorrow · 1 overdue
```

### User Flow

```
[User opens /recurring]
  → Sees list of recurring expenses
  → [+] Add new: name, amount, category, day of month
  → [Edit] modifies existing
  → [Delete] confirms then soft-deletes

[User clicks [Bayar] on unpaid item]
  → Mark recurringPayment as paid
  → Open TransactionDrawer with:
      type: "expense"
      amount: prefilled from recurringExpense.amount
      categoryId: prefilled
      description: "Listrik - June 2026" (auto-generated)
  → User clicks Save → transaction created
  → Toast: "Paid and transaction recorded"

[Dashboard recurring card]
  → Shows summary + upcoming reminders
  → [View All] navigates to /recurring
```

### Files

```
convex/recurring.ts              [NEW]
  → schema, queries, mutations for recurringExpenses + recurringPayments

convex/schema.ts                 [MODIFY]
  → Add recurringExpenses + recurringPayments tables

app/recurring/page.tsx           [NEW]
  → List + CRUD page

components/recurring/            [NEW]
  ├─ RecurringList.tsx           — list with status badges
  ├─ RecurringForm.tsx           — add/edit form
  └─ RecurringCard.tsx           — dashboard card

components/dashboard/RecurringSummary.tsx  [NEW]
  → Dashboard card for recurring bills

app/dashboard/page.tsx           [MODIFY]
  → Add RecurringSummary to grid
```

---

## Future: Phase 4b (Coach AI) + 4d (Calendar)

Not in scope for this spec. Briefly:

- **4b Coach AI**: Uses `recurringExpenses` data (future) + existing transaction data for insights
- **4d Calendar**: Visual calendar showing recurring due dates + transactions

---

## Scope Exclusions

- Auto-create transactions from recurring (user must confirm via TransactionDrawer)
- Push notifications for due bills
- Recurring income (MVP is expense-only)
- Split recurring expenses across categories
- Coach AI integration (future phase)

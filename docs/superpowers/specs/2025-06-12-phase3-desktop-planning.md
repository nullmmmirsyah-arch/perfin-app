# Phase 3: Desktop Planning — MonthlyComparison, WhatIfSimulator, BudgetQuickEdit

## Goal
Add three planning tools to the desktop dashboard: monthly spending comparison, what-if budget scenario simulator, and quick budget limit editing.

## Architecture

```
MonthlyComparison ─── getMonthlyTrends (existing, uses month 0 vs 1)
WhatIfSimulator    ─── summary.budgetBreakdown (existing, client-side only)
BudgetQuickEdit   ─── summary.budgetBreakdown + upsertBudget mutation (existing)
```

No new Convex queries needed. All data comes from existing endpoints.

---

## Component 1: MonthlyComparison

**File:** `components/dashboard/MonthlyComparison.tsx` (new)

**Purpose:** Show a compact summary card comparing this fiscal month's spending vs last month.

**Data:** `getMonthlyTrends` (months=2), entries index 0 (current) and 1 (previous)

**Layout:**
```
┌─────────────────────────────────────┐
│ vs Last Month                       │
│                                      │
│  ↓ 12%                               │
│ Rp2,1jt this month · Rp2,4jt last   │
│                                      │
│ biggest changes:                     │
│  Food         ↑ 35%  +Rp120rb       │
│  Transport    ↓ 28%  -Rp85rb        │
│  Bills        ↓ 5%   -Rp15rb        │
└─────────────────────────────────────┘
```

**Spesifikasi:**
- Header: "vs Last Month"
- Overall change percentage with arrow:
  - ↓ hijau (success) if spending decreased (good)
  - ↑ merah (destructive) if spending increased (bad)
- Subtitle: "RpX this month · RpY last month"
- Top 3 category changes by absolute difference
  - Each: category name + arrow + percentage + formatted difference
  - Green for decrease, red for increase
- Props: `{ householdId?: Id<"households">, isPrivacyMode?: boolean }`
- States: loading (skeleton), empty (needs 2 months data)

---

## Component 2: WhatIfSimulator

**File:** `components/dashboard/WhatIfSimulator.tsx` (new)

**Purpose:** Interactive sliders to adjust budget limits and see impact on daily allowance in real-time.

**Data:** `summary.budgetBreakdown` (existing prop, same as other dashboard components)

**Layout:**
```
┌─────────────────────────────────────┐
│ What If...                          │
│                                      │
│ Food        Rp400rb ───●──── Rp500rb│
│ Transport   Rp200rb ●────── Rp150rb│
│ Bills       Rp300rb ──●─── Rp350rb │
│                                      │
│ Total budget:  Rp950rb (↓Rp50rb)    │
│ Daily allowance: Rp45rb (↓Rp2rb)    │
│                                      │
│ [Reset]                              │
└─────────────────────────────────────┘
```

**Spesifikasi:**
- Data dari `summary` prop (existing) — butuh `remainingBudget`, `budgetBreakdown`, `budgetStartDay`
- Tiap kategori dengan `enablePacing !== false` dan `limit > 0`:
  - Nama kategori
  - Current limit (format rupiah)
  - Range slider: 50%–150% dari original limit
  - Step: Rp10.000
- Impact calculation (client-side, real-time):
  - Total adjusted budget = sum of all slider values
  - vs original total
  - Daily allowance = adjusted remaining / `calculateFiscalDaysRemaining`
- Reset button: balikin semua slider ke nilai original
- Props: `{ summary: SummaryData, isPrivacyMode?: boolean }`
- States: loading (skeleton jika summary null), empty (no budgets)

---

## Component 3: BudgetQuickEdit

**File:** `components/dashboard/BudgetQuickEdit.tsx` (new)

**Purpose:** Quick inline edit of budget limits from the dashboard without navigating to /budgets page.

**Data:** `summary.budgetBreakdown` (existing)
**Mutation:** `api.budgets.upsertBudget` (existing)

**Layout:**
```
┌─────────────────────────────────────┐
│ Budget Quick Edit                    │
│                                      │
│ Food         Rp400rb     [ 400,000 ] │
│ Transport    Rp200rb     [ 200,000 ] │
│ Bills        Rp300rb     [ 300,000 ] │
│                                      │
│ [ Save Changes ]                     │
└─────────────────────────────────────┘
```

**Spesifikasi:**
- Daftar kategori dengan `enablePacing !== false` dan `limit > 0`
- Tiap baris: nama + current limit (read-only) + input number (editable)
- Input: plain number input (not formatted), validation min 0
- Track perubahan: Map<categoryId, newAmount> — cuma kategori yang diubah dikirim
- Save button: disabled jika tidak ada perubahan
- On save: call `upsertBudget` per kategori yang berubah (dengan fiscal year/month saat ini)
- Fiscal year/month: computed dari `getFiscalDate(new Date(), budgetStartDay)`
- Success toast via `sonner`
- Props: `{ summary: SummaryData, budgetStartDay?: number, isPrivacyMode?: boolean }`
- States: loading (skeleton), empty (no budgets), saving (disabled button + spinner)

---

## Desktop Grid Update

**File:** `app/dashboard/page.tsx`

New desktop layout:
```
Desktop (md:grid-cols-2):
├── Row 1:
│   ├── Left:  DailyOperationsCard
│   └── Right: TrendChart
├── Row 2:
│   ├── Left:  MonthlyComparison
│   └── Right: WhatIfSimulator
├── Row 3:
│   ├── Left:  (empty/balance summary)
│   └── Right: BudgetQuickEdit
└── Bottom: RecentTransactions (full width)
```

Rows use the existing `md:grid-cols-2` grid. Each card spans 1 column.

---

## Data Flow

```
User adjusts slider/input
  → local state updates
  → impact calculated client-side (WhatIfSimulator)
  or
User clicks Save (BudgetQuickEdit)
  → upsertBudget mutation per category
  → Convex auto-updates summary
  → all components re-render

No new backend queries needed.
```

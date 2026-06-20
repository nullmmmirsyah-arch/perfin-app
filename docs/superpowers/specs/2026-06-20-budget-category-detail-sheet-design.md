# Budget Category Detail Sheet

**Date:** 2026-06-20
**Status:** Approved

## Problem

The mobile "Budget Today" card (`MobileBudgetToday`) shows per-category daily allowance but lacks two pieces of information users need for planning:

1. **Sisa budget per category** — how much budget remains per category
2. **Per-pekan allowance** — how much can be spent per week per category

Adding both inline would overwhelm the already-compact per-category rows on mobile.

## Approach

**Option 1: Tap-to-Sheet** (chosen over Floating Pill)

Keep per-category rows in their current compact form (name + progress bar + daily limit). Make each row tappable. On tap, open a bottom sheet (vaul `Drawer`) showing full detail for that category: progress percentage, remaining budget, daily limit, weekly limit, and a link to view all transactions in that category.

## Layout

### Main Card (unchanged)

The `MobileBudgetToday` card stays visually identical to the current implementation:

```
┌──────────────────────────────────┐
│ BUDGET TODAY         [On Track]  │
│ ▓▓▓▓▓▓▓▓▓░░░░░                   │
│ Rp1.7jt spent of Rp2.5jt  12d left│
│                                  │
│ Daily Allowance per Category     │
│ Makanan              Rp 30rb/hari│ ← tappable
│ ▓▓▓▓▓▓░░░░░                      │
│ Transport            Rp 20rb/hari│ ← tappable
│ ▓▓▓▓░░░░░░░                      │
│ [+ 3 other budgets on track]     │
│                                  │
│ Spent Today       Rp 45rb/83rb   │
│ • Kopi pagi            -Rp 15rb  │
│ • Makan siang          -Rp 30rb  │
└──────────────────────────────────┘
```

**Only addition:** each category row gains:
- `cursor-pointer` / tap feedback
- A subtle `ChevronRight` icon at the end of the row to indicate tappability
- An `onClick` handler opening the detail sheet

### Bottom Sheet (new)

Opened via vaul `Drawer`, rendered inside `MobileBudgetToday`. Content:

```
┌──────────────────────────────────┐
├──────────────────────────────────┤ (drag handle)
│                                  │
│ Makanan                   [Edit] │
│ ▓▓▓▓▓▓▓▓▓▓░░░░ 68%              │
│                                  │
│ Sisa Budget       Rp 800.000     │ ← NEW (primary)
│ Anggaran          Rp 2.500.000   │
│ Terpakai          Rp 1.700.000   │
│                                  │
│ ── Pacing ──                     │
│ Harian            Rp 30.000/hari │ ← existing
│ Mingguan          Rp 200.000/mgg │ ← NEW
│ Sisa hari         12 hari        │
│                                  │
│ [Lihat transaksi Makanan →]      │
│                                  │
└──────────────────────────────────┘
```

### Weekly Allowance Calculation

```
weeklyAllowance = dailyAllowance × 7
```

Where `dailyAllowance = remaining / calculateFiscalDaysRemaining(startDay)`

Reuses existing `calculateFiscalDaysRemaining` and `calculateBudgetPace` from `lib/finance-utils.ts`.

### Interaction

| Action | Behavior |
|--------|----------|
| Tap category row | Opens vaul `Drawer` with snap point at ~60% |
| Tap "Edit" in sheet | Navigates to `/budgets` (or inline edit — future) |
| Tap "Lihat transaksi" | Navigates to `/transactions?categoryId=xxx` (future) |
| Swipe down / tap scrim | Dismisses sheet |
| Privacy mode | All amounts masked in sheet too |

## Data Flow

The summary data (`SummaryData`) already contains `budgetBreakdown` with all needed fields:

```typescript
type BudgetBreakdownItem = {
  categoryId: string
  categoryName: string
  categoryType: string
  limit: number       // monthly budget amount
  spent: number       // spent so far
  remaining: number   // limit - spent
  enablePacing?: boolean
  // ... other fields unchanged
}
```

Weekly allowance is derived client-side in the sheet component using existing finance utilities — no new Convex queries needed.

## Testing

- Tap each category row → sheet opens with correct data
- Verify weekly allowance = dailyLimit × 7
- Verify privacy mode masks amounts in sheet
- Verify sheet dismisses on swipe-down / scrim tap
- Verify sheet does not break when `budgetBreakdown` is empty
- Verify accessibility: sheet traps focus, announces role="dialog"

## Future Possibilities

- Mini sparkline chart (7-day spending trend) inside sheet
- "Adjust budget" action inside sheet
- Recent transactions for that category listed inline
- Quick-add transaction pre-filled with category

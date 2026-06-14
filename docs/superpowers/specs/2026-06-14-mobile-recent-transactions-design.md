# Mobile Recent Transactions — Compact Card Design

## Problem

The `TransactionListGrouped` component is shared between mobile and desktop with no mobile-specific optimizations. On mobile, each transaction renders as a full card with expand chevron, action dropdown (MoreHorizontal), optional label badges, and expandable detail panel — too dense and action-heavy for quick scanning.

## Solution

Create a new `MobileRecentTransactions` component for the mobile dashboard that replaces the shared `TransactionListGrouped` in the mobile view.

## Layout

### Row Structure (~52px height)

```
[●] Description                     -Rp50.000
    Category · Relative date
```

- **Color dot**: 10px circle, colored by type:
  - Red (`#dc2626`) for expense
  - Green (`#16a34a`) for income
  - Blue (`#2563eb`) for transfer
- **Description**: `text-sm font-medium`, single line truncated
- **Second line**: `text-xs text-muted-foreground`, category name + bullet + relative date ("Hari ini", "Kemarin", "N Jun")
- **Amount**: Right-aligned, `text-sm font-bold`, colored by type (red/green for expense/income, default for transfers), privacy mode via `formatCurrency`
- **Divider**: Subtle `border-b border-border/50` between rows, no card border
- **Wrapper**: `Card > CardContent pt-5` — konsisten dengan MobileBudgetToday, MobileRecurringRow, MobileDashboardTabs
- **Header**: "Recent Transactions" + "View All" link, same as current layout

### Split Transactions

- Rendered as a single row with total amount
- Description: jika main transaction punya `description`, pakai itu. Jika tidak, gabung nama split items (max 2 + "N lainnya")
- Second line: badge `Split N` (inline `bg-muted` rounded) + date
- Background subtly tinted (`bg-muted/20`) to differentiate
- Tap → expand detail breakdown (sama seperti expand normal)

## Data & Count

- Shows **maximum 5 transactions** from `summary.recentTransactions`
- "Lihat Semua →" link at bottom navigates to `/transactions`
- Data comes from `summary.recentTransactions` (already fetched by `getDashboardSummary`)

## Interaction

- **Tap anywhere on collapsed row** → expand inline detail (animated via framer-motion `AnimatePresence`)
- **Tap expanded row header** → collapse
- **Tap another row** → collapse current, expand new
- **Expanded detail** shows:
  - **Normal tx**: Account, Category, Description in 2-column grid
  - **Split tx**: Breakdown list per split item (bullet + name + amount)
  - **Edit/Delete buttons** below detail (with `stopPropagation` so row doesn't toggle)
- Delete flow remains through `setTransactionToDelete` dialog (same as current)

## Props

```ts
type Props = {
  transactions: TransactionWithDetails[]
  onEdit: (tx: TransactionWithDetails) => void
  onDelete: (tx: TransactionWithDetails) => void
  isPrivacyMode?: boolean
}
```

## States

| State | Handling |
|---|---|
| **Loading** | `RecentTransactionsSkeleton` (existing) |
| **Empty** | Icon + "Belum ada transaksi" |
| **Normal** | List of max 5 rows |
| **Privacy mode** | Amounts masked via `formatCurrency(value, { isPrivacyMode })` |
| **Null/undefined** | No transactions message |

## Integration

- Created in `components/dashboard/MobileRecentTransactions.tsx`
- In `app/dashboard/page.tsx`, replace `TransactionListGrouped` inside the mobile section (keep `TransactionListGrouped` for desktop)
- Import and render: `<MobileRecentTransactions transactions={...} onEdit={handleEdit} onDelete={setTransactionToDelete} isPrivacyMode={isPrivacyMode} />`
- Header "Recent Transactions" + "View All" link moved inside the new component
- Existing `TransactionListGrouped` section wrapped with `hidden md:block` for desktop only

## Non-Goals

- No swipe gestures
- No long-press actions
- No inline editing
- No changes to desktop `TransactionListGrouped` or full `/transactions` page

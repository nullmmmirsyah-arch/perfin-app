# Mobile Nav Redesign — Gear Icon + FAB in BottomNav

## Problems

1. **Missing menu items on mobile**: Categories, Labels, Accounts pages have no navigation access on mobile since BottomNav was reduced to 5 visible items.
2. **FAB covers BottomNav**: The centered FAB overlaps the "Budgets" nav item making it untappable.

## Solutions

### 1. Gear Icon in PageHeader

A gear icon (`Settings` from lucide-react) is added next to the privacy toggle in `PageHeader`. Tapping it opens a **bottom sheet** (using existing shadcn Drawer component) with links to:

- Goals (`/goals`)
- Categories (`/categories`)
- Labels (`/labels`)
- Accounts (`/accounts`)

Each row shows an icon + label + chevron right, styled as a list.

### 2. FAB Integrated into BottomNav

The mobile `GlobalTransactionFAB` is removed. The FAB moves **inside** `BottomNav` as an iOS-style floating action button between Trans and Budgets.

#### BottomNav Layout (mobile only)

```
[Home]  [Trans]  [+ FAB]  [Budgets]  [Reports]
```

- 4 nav items + centered FAB
- FAB: 40px circle (`h-10 w-10`), `bg-primary` with `+` icon, `shadow-lg`, `border-4 border-background`
- Label "Tambah" in `text-primary` below the FAB
- FAB opens `TransactionDrawer` via internal state (moved from `GlobalTransactionFAB`)
- Active state highlighting works for the 4 nav items
- Desktop BottomNav remains hidden (unchanged)

#### Component Changes

**`components/BottomNav.tsx`:**
- Remove `Target` (Goals) icon from imports
- Add `Plus` icon import
- 4 nav items: LayoutDashboard (Home), ArrowLeftRight (Trans), PiggyBank (Budgets), FileBarChart (Reports)
- Insert FAB between Trans and Budgets
- Add `TransactionDrawer` import and open/close state
- FAB onClick sets `open(true)`

**`components/GlobalTransactionFAB.tsx`:**
- Remove mobile section (`md:hidden` block). Keep tablet section or delete entire component if tablet uses sidebar.

**`components/LayoutWrapper.tsx`:**
- Remove `<GlobalTransactionFAB />` import and usage

**`components/PageHeader.tsx`:**
- Add `Settings` icon button next to privacy toggle
- Import and render `SettingsSheet` (or inline Drawer)

**`components/SettingsSheet.tsx` (new):**
- Uses shadcn Drawer (same as TransactionDrawer pattern)
- Props: `open`, `onOpenChange`
- Content: List of links — Goals, Categories, Labels, Accounts
- Each link uses `next/link` with icon + label + chevron-right
- Closes drawer on navigation

## Data Flow

No new data fetching needed — all links navigate to existing pages which fetch their own data.

## States

| Component | State | Handling |
|---|---|---|
| SettingsSheet | Open | Drawer with links |
| SettingsSheet | Closed | Hidden |
| SettingsSheet | Navigation | `router.push` + `onOpenChange(false)` |
| BottomNav FAB | Normal | Rendered as primary button |
| BottomNav FAB | Open | Opens TransactionDrawer |

## Files Changed

| File | Change |
|---|---|
| `components/BottomNav.tsx` | 4 items + FAB, TransactionDrawer state |
| `components/GlobalTransactionFAB.tsx` | Remove mobile section |
| `components/LayoutWrapper.tsx` | Remove GlobalTransactionFAB |
| `components/SettingsSheet.tsx` | **New** — gear drawer with links |
| `components/PageHeader.tsx` | Add gear icon button |
| `app/(auth)/layout.tsx` or relevant layout | No change needed (BottomNav already in LayoutWrapper) |

## Non-Goals

- Desktop sidebar remains unchanged
- No changes to existing page content
- No new pages
- No changes to TransactionDrawer behavior

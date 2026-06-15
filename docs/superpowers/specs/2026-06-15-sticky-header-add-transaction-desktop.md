# Sticky Header + Mobile Settings Gear in LayoutWrapper

## Problem

1. **Desktop:** "Add Transaction" button in the top header disappears when scrolling.
2. **Mobile:** Gear icon (SettingsSheet — access to Goals, Categories, Labels, Accounts) lives inside `PageHeader`, which is page-level. When scrolling, the gear icon scrolls away. It also means each page must include `PageHeader` to get settings access.

## Solution

Make the `<header>` sticky across all screen sizes and move the SettingsSheet/gear icon from `PageHeader` into the persistent `LayoutWrapper` header.

---

### Section 1: Sticky Header

**File:** `components/LayoutWrapper.tsx`

Add to the `<header>` element (line 97):

| Class | Purpose |
|---|---|
| `sticky top-0` | Fixes header to top of viewport on scroll |
| `z-10` | Keeps header above page content |
| `bg-background` | Solid background so content doesn't show through |

Applied globally (no responsive prefix) so both mobile and desktop get a sticky header.

---

### Section 2: Move Gear Icon to LayoutWrapper Header

**File:** `components/LayoutWrapper.tsx`

- Add `settingsOpen` state alongside existing `isTransactionOpen`
- Render a gear button in `<header>` before `<NotificationBell>`, with `md:hidden` class (mobile only)
- Render `<SettingsSheet>` alongside `<TransactionDrawer>` and `<BottomNav>`
- Desktop is unaffected — gear button is hidden via `md:hidden`

---

### Section 3: Cleanup `PageHeader.tsx`

Remove from `PageHeader.tsx`:
- Import of `SettingsSheet`
- `settingsOpen` useState
- Gear `Button` with Settings icon
- `<SettingsSheet>` component instance

`PageHeader` retains: `title`, `description`, `action`, `onTogglePrivacy`, `isPrivacyMode` — unchanged.

---

## Files Changed

| File | Change |
|---|---|
| `components/LayoutWrapper.tsx` | Sticky header classes; add gear button + SettingsSheet |
| `components/PageHeader.tsx` | Remove gear button, SettingsSheet, related imports/state |

## Not Changed

- `components/SettingsSheet.tsx` — unchanged, just moved parent
- `app/dashboard/page.tsx` and all other pages — no changes needed
- Sidebar, BottomNav, TransactionDrawer — unchanged

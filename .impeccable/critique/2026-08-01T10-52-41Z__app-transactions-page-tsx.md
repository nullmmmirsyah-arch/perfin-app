---
target: app/transactions/page.tsx
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-01T10-52-41Z
slug: app-transactions-page-tsx
---
# Critique: Transactions Page

**Target**: `app/transactions/page.tsx`
**Date**: 2026-08-01
**Mode**: Operate

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons during load; no total count or analytics completeness indicator |
| 2 | Match System / Real World | 3 | Filter badge prefixes ("Acc:", "Cat:") are abbreviated jargon |
| 3 | User Control and Freedom | 4 | Clear X buttons, "Clear all", undo via drawer |
| 4 | Consistency and Standards | 3 | Tabs component contradicts product guideline (should be swipeable carousel) |
| 5 | Error Prevention | 3 | Empty states guide action; delete success is ephemeral toast only |
| 6 | Recognition Rather Than Recall | 2 | PERFIN_FILTER_CATEGORY custom event is invisible/undiscoverable |
| 7 | Flexibility and Efficiency of Use | 3 | Search + multi-filter powerful; no keyboard shortcuts or saved filters |
| 8 | Aesthetic and Minimalist Design | 2 | Filter popover with 6 stacked MultiSelects is dense |
| 9 | Error Recovery | 3 | ErrorBoundary catches crashes; no inline zero-results guidance |
| 10 | Help and Documentation | 1 | No tooltips explaining split transactions, labels, or filter system |
| **Total** | | **27/40** | **Good** |

---

## Design Specificity Verdict

**Grounded in this product.** The composition encodes finance-specific concepts (expense/income/transfer type badges, budget-aware date defaults, split-transaction indicators, merchant icons, privacy masking). A generic "list page" template would lack fiscal month awareness, split-transaction breakdowns, and the label/category filter badges with color dots.

**Deterministic scan**: 5 advisory findings (font sizes off DESIGN.md ramp). No warnings or errors.

---

## Overall Impression

The transactions page is a solid, functional data table with strong filtering. The biggest opportunity is transforming it from a "list with filters" into a "financial insight surface" — where the list, analytics, and filters work together rather than competing for attention.

---

## What's Working

1. **Filter badge system is excellent.** Each active filter shows as a removable badge with clear labels and a "Clear all" escape hatch. Textbook progressive disclosure.

2. **Date-grouped sticky headers with daily totals.** The `TransactionListGrouped` component shows net daily flow next to the date — a finance-specific insight no generic list page would have.

3. **Split transaction handling is thoughtful.** The `GitBranch` icon, opacity dimming of non-matching splits, and breakdown panel show deep domain consideration.

---

## Priority Issues

### P0 — Blocking

1. **Mixed-language tooltip.** `TransactionItem.tsx:112` shows "Transaksi ini di-split" — an Indonesian string hardcoded in an otherwise English UI. Breaks i18n expectations and confuses non-Indonesian users.
   - **Fix**: Replace with `"This transaction is split"` or use a translation key.
   - **Suggested command**: `$impeccable clarify`

### P1 — Major

2. **Analytics tab shows incomplete data without clear framing.** The disclaimer says analytics are partial, but the user has no way to know *how* partial. This undermines trust at the exact moment the user is trying to gain insight.
   - **Fix**: Auto-load all transactions when analytics tab is selected, or show a progress indicator ("Showing 40 of ~120 transactions").
   - **Suggested command**: `$impeccable clarify`

3. **Tabs component contradicts product guidelines.** `PRODUCT_GUIDELINES.md` specifies swipeable tabs for page-level view switches. The current `Tabs` component doesn't support swipe gestures.
   - **Fix**: Replace with swipeable tab component or justify why Tabs is preferred.
   - **Suggested command**: `$impeccable adapt`

### P2 — Minor

4. **`PERFIN_FILTER_CATEGORY` custom event is undiscoverable.** `TransactionListGrouped.tsx:31` listens for a custom DOM event that applies a category filter — but there's no visible UI trigger and no documentation of how to clear it.
   - **Fix**: Add a visual connection between chart clicks and list filtering, or add a toast explaining what happened.
   - **Suggested command**: `$impeccable clarify`

5. **Filter badge prefixes are inconsistent.** Type badges show just the value (`expense`), but others show `Acc:`, `Cat:`, `Merchant:` prefixes. This inconsistency adds cognitive load.
   - **Fix**: Either prefix all or none.
   - **Suggested command**: `$impeccable clarify`

### P3 — Polish

6. **"Load More" pattern could be infinite scroll.** The manual "Load More" button interrupts browsing flow. Consider intersection observer-based infinite scroll for mobile.
   - **Suggested command**: `$impeccable optimize`

7. **Empty state action is type-locked.** The "Add Expense" action only opens the expense drawer, not a type selector. If the user wanted to add income first, they'd need to switch tabs inside the drawer.
   - **Suggested command**: `$impeccable clarify`

---

## Persona Red Flags

| Persona | Red Flag |
|---------|----------|
| **New user (first week)** | No onboarding cues. Filter popover has 6 dimensions with no explanation of what "Labels" or "Merchants" are. PERFIN_FILTER_CATEGORY could activate invisibly. |
| **Privacy-conscious user** | `isPrivacyMode` prop exists but isn't surfaced on this page. Users sharing a household device have no way to toggle privacy from the transactions view. |
| **Power user / data analyst** | Analytics tab showing partial data is the biggest friction point. A user who switches to analytics expects a complete picture, not a caveat. |

---

## Minor Observations

- `page.tsx:81-85`: End-of-day time normalization done inline with IIFE — could be extracted to utility
- `TransactionItem.tsx:66`: Touch target for edit/delete is small (32x32px MoreHorizontal button)
- `TransactionListGrouped.tsx:146`: `backdrop-blur-md` on sticky headers may cause performance issues on lower-end mobile devices

---

## Questions to Consider

1. **Why is there a List/Analytics toggle at all?** Could analytics be a collapsible summary above the list, so users always see both context and detail?

2. **What happens at 500+ transactions?** The current pagination means 25 clicks to see everything. Is this the best experience for a power user reconciling month-end?

3. **Should filters persist across page visits?** Currently, opening the filter always shows all 6 dimensions. If a user repeatedly filters by "Expense only," they must re-apply it every session.

4. **Is the mixed language deliberate?** If Perfin targets Indonesian users primarily, should the entire UI be in Bahasa? If bilingual, the inconsistency is worse than picking one language.

---

## Run Notes

- **Target slug**: `app-transactions-page-tsx`
- **Ignore list**: None (no `.impeccable/critique/ignore.md` found)
- **Assessment independence**: Dual-agent (A: design review, B: detector scan)
- **CLI detector**: 5 advisory findings (font sizes off DESIGN.md ramp)
- **Browser visualization**: Not available (no browser automation configured)
- **Overlay injection**: Skipped (no browser)
- **Live server**: Not started (no browser)
- **Temp cleanup**: N/A

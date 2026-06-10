# Mobile Amount Input Bottom Sheet

## Problem

Perfin's mobile transaction input currently relies on the native mobile numeric keyboard for the amount field (`inputMode="numeric"`). This provides a poor UX — the native keyboard is generic, takes up screen space, and doesn't match the app's visual language. Finance apps commonly replace this with a custom numpad keypad for a more polished and faster input experience.

## Approach

Build a **bottom sheet (Vaul Drawer) with a custom numpad** that appears when the user taps the amount field. The sheet overlays the existing TransactionDrawer, keeping the form context visible behind it.

## Design Decisions

### Layout
- **Bottom sheet overlay** — appears on top of the existing drawer (transparent background)
- **Finance App Style numpad layout:**
  ```
  1  2  3
  4  5  6
  7  8  9
  .  0  ⌫
  ──── Done ────
  ```
- Amount displayed in large centered text (5xl, bold) at the top
- Currency prefix (Rp) with thousand-separator formatting via existing `formatNumber`
- Done button: full-width, primary, disabled when amount is 0
- Cancel via text button or swipe-down

### Behavior
- Each keystroke updates the display in real-time
- Backspace (⌫) removes the last digit
- Decimal (.) allows one decimal point
- Done → updates form value → closes the bottom sheet
- Overflow protection: font scales down for very large amounts
- Haptic feedback on tap (`navigator.vibrate(10)`)
- `isOverspent` warning displayed in the bottom sheet header (red "Insufficient Balance")

### Integration
- New `MobileAmountInput` component (drawer wrapping a numpad)
- Triggered by tapping the amount area in `TransactionFormFields` (mobile mode)
- Replaces the current `<Input inputMode="numeric">` for mobile
- Props: `value`, `onChange`, `onDone`
- Only `TransactionDrawer.tsx` changes (or `MobileAmountInput.tsx` if extracted)

### Split Item Amount Fields
- Each split item's amount field in `SplitEditorDrawer` also gets the same numpad bottom sheet treatment
- In mobile mode, each split item amount `<Input inputMode="numeric">` (line 169-203) is replaced with a tappable card that opens the same `MobileAmountInput` bottom sheet
- Separate `MobileAmountInput` instance per split item (tracked by `splitIndex`)
- Done button updates `splits.[index].amount` form field and closes the sheet
- Summary card (Total / Allocated / Remaining) updates in real-time as each split amount changes

### What Stays the Same
- Desktop (Sheet) mode unchanged
- Desktop SplitEditor unchanged (still uses compact Input fields)
- Form validation, submission logic, and all other fields (Account, Category, Date, Label, Note) unchanged
- `formatNumber` / `parseAmount` utilities reused
- Existing `MobileInputCard` and `MobileSelectionDrawer` unchanged

## Files Changed

| File | Change |
|---|---|
| `components/TransactionDrawer.tsx` | Add `MobileAmountInput` usage; remove native input for mobile amount field |
| `components/SplitEditorDrawer.tsx` | Add `MobileAmountInput` usage for each split item amount field (mobile only) |
| `components/mobile-amount-input.tsx` (new) | Bottom sheet with numpad keypad and amount display |

## Testing

- Verify numpad renders on mobile (or responsive preview) when tapping amount field
- Verify each digit appends correctly, backspace removes, decimal inserts once
- Verify Done button updates form and closes sheet
- Verify `isOverspent` warning appears when amount exceeds account balance
- Verify overflow scaling for large amounts
- Verify scrolling is locked on the drawer beneath while bottom sheet is open
- Verify haptic feedback fires on key press
- Verify split item amount fields also trigger the numpad bottom sheet on mobile
- Verify updating a split item amount via numpad updates the summary card (Allocated / Remaining)
- Verify each split item has its own `MobileAmountInput` instance (no cross-contamination)

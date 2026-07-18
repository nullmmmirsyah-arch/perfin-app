# Design: Paste Feature for MobileAmountInput

## Summary

Add clipboard paste support to the `MobileAmountInput` numpad component via long press on the display amount area. Users can paste numeric values from clipboard, which are automatically parsed and formatted.

## Trigger

Long press (~500ms) on the display amount area (the large "Rp {amount}" text above the numpad). Implemented via `onPointerDown`/`onPointerUp` with `setTimeout`.

## Value Parsing

Strip all non-digit characters except one decimal point:
- `"Rp 50.000"` → `"50000"`
- `"50,000.50"` → `"50000.50"`
- `"IDR 50000"` → `"50000"`
- `"abc"` → empty (invalid)

Use existing `formatNumber()` from the component to format the parsed value before calling `onChange`.

## Behavior

- Paste **replaces** the entire current value (not insert at cursor)
- After paste, the numpad remains open for further editing
- Haptic feedback (`navigator.vibrate(10)`) on successful paste

## Error Handling

| Scenario | Action |
|----------|--------|
| Clipboard permission denied | Toast: "Clipboard access denied" |
| Empty clipboard | Toast: "Nothing to paste" |
| Non-numeric content | Toast: "Invalid amount" |
| Number exceeds max (99,999,999,999) | Clamp to max, toast: "Amount capped at maximum" |

## Visual Feedback

- Toast notification via `sonner` (already used throughout codebase): "Amount pasted"
- Optional: subtle "Long press to paste" hint text below the amount when numpad opens (shown once, fades after 2s or on first interaction)

## Files to Modify

- `components/mobile-amount-input.tsx` — Add long press handler, clipboard read, parse logic, toast feedback

## Dependencies

- `sonner` — already installed and used across the app
- `navigator.clipboard.readText()` — modern Clipboard API, requires HTTPS (already met in production)

## Out of Scope

- Paste support for desktop `<Input>` amount fields (desktop already has native paste)
- Paste support for other drawers using plain `<Input>` (BudgetDrawer, AccountDrawer, etc.)
- Auto-detect clipboard on drawer open (too intrusive)

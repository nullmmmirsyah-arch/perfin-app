# Desktop TransactionDrawer: Dialog → Sheet

**Date:** 2026-06-08
**Status:** Approved
**Author:** opencode

## Problem

Desktop TransactionDrawer uses `<Dialog>` (centered modal), which feels heavy and interrupts workflow. A `<Sheet>` (slide-in panel) is more natural for form-based data entry alongside the main content.

## Scope

One file: `components/TransactionDrawer.tsx`. Swap the desktop wrapper component while keeping all form logic identical.

## Design

### Component Swap

| Current | New |
|---------|-----|
| `Dialog` | `Sheet` |
| `DialogContent` | `SheetContent` |
| `DialogHeader` | `SheetHeader` |
| `DialogTitle` | `SheetTitle` |
| `DialogClose` | `SheetClose` |

All imports come from `@/components/ui/sheet`, which is already present in the project.

### Layout Changes

- **Position:** `side="right"`
- **Width:** `sm:max-w-[500px]` (was 600px on Dialog — narrower since Sheet overlays content partially)
- **Height:** Sheet takes full viewport height natively — remove `max-h-[90vh]`
- **Scrolling:** Keep `<div className="flex-1 overflow-y-auto p-6 pt-2">` unchanged
- **Footer:** Remove `-mx-6 px-6` from the footer div — SheetContent uses `p-0` so border spans correctly without negative margin trick

### Unchanged

All form internals: type tabs, amount field, TransactionFormFields, TransferFormFields, SplitEditorDrawer, validation, submission, mobile `<Drawer>` branch, `handleOpenChangeWrapper`, discard dialog, `isDirty` tracking. Footer div classes (`-mx-6 px-6`) also unchanged — same structure preserves full-width border.

## Migration Steps

1. Replace imports (5 components)
2. Replace wrapper + content components
3. Adjust container classes (`sm:max-w-[500px]`, remove `max-h-[90vh]`)
4. Replace `DialogClose` with `SheetClose` in form footer
5. Verify build (`tsc --noEmit`)

## Risks

None. Sheet and Dialog share the same Radix primitive (`@radix-ui/react-dialog`) with identical API — the change is purely visual. Risk level: very low.

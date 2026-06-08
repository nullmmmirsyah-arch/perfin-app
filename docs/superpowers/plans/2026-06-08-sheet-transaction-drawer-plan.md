# Desktop TransactionDrawer: Dialog → Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop `<Dialog>` wrapper with `<Sheet>` in `TransactionDrawer.tsx`.

**Architecture:** One file change. Swap 5 imports and 5 component names. Sheet uses the same Radix primitive as Dialog — no behavioral changes. All form logic unchanged.

**Tech Stack:** shadcn Sheet (`@radix-ui/react-dialog`), Next.js, TypeScript

---

### Task 1: Swap Dialog → Sheet in TransactionDrawer.tsx

**Files:**
- Modify: `components/TransactionDrawer.tsx` (lines 14-18 imports, lines 371-388 wrapper)

**Step 1: Update imports**

Replace:
```typescript
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
```

With:
```typescript
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet'
```

**Step 2: Replace desktop wrapper**

Replace:
```tsx
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent 
                className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0"
            >
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2">
                 <TransactionForm 
                    {...props} 
                    isMobile={false} 
                    splitDrawerOpen={splitDrawerOpen}
                    setSplitDrawerOpen={setSplitDrawerOpen}
                    onDirtyChange={setIsDirty}
                 />
            </div>
            </DialogContent>
        </Dialog>
```

With:
```tsx
        <Sheet open={open} onOpenChange={handleOpenChangeWrapper}>
            <SheetContent 
                side="right"
                className="sm:max-w-[500px] flex flex-col p-0 gap-0"
            >
            <SheetHeader className="p-6 pb-2">
                <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-6 pt-2">
                 <TransactionForm 
                    {...props} 
                    isMobile={false} 
                    splitDrawerOpen={splitDrawerOpen}
                    setSplitDrawerOpen={setSplitDrawerOpen}
                    onDirtyChange={setIsDirty}
                 />
            </div>
            </SheetContent>
        </Sheet>
```

Changes:
- `Dialog` → `Sheet`
- `DialogContent` → `SheetContent`
- Added `side="right"`
- `sm:max-w-[600px]` → `sm:max-w-[500px]`
- Removed `max-h-[90vh]` (Sheet is full-height natively)
- `DialogHeader` → `SheetHeader`
- `DialogTitle` → `SheetTitle`

**Step 3: Replace DialogClose in form footer**

Find:
```tsx
<DialogClose asChild>
    <Button variant="outline" type="button" disabled={isProcessing}>Cancel</Button>
</DialogClose>
```

Replace with:
```tsx
<SheetClose asChild>
    <Button variant="outline" type="button" disabled={isProcessing}>Cancel</Button>
</SheetClose>
```

**Step 4: Remove unused dialog import**

Run `tsc --noEmit` — if there are unused import warnings, remove the import of `dialog.tsx`.

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: no output (success)

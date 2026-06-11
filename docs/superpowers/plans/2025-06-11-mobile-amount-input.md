# Mobile Amount Input Bottom Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native mobile numeric keyboard with a custom numpad bottom sheet for transaction amount input (main form + split items).

**Architecture:** A new `MobileAmountInput` component (Vaul Drawer) displays a numpad keypad. It's triggered by tapping the amount field in `TransactionFormFields` (mobile mode) or individual split item amount fields in `SplitEditorDrawer`. Internal state tracks raw digits; display shows formatted amount with thousand separators.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Vaul Drawer, lucide-react, react-hook-form

---

### Task 1: Create MobileAmountInput component

**Files:**
- Create: `components/mobile-amount-input.tsx`

- [ ] **Step 1: Create `MobileAmountInput` component**

```tsx
import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import { cn, parseAmount } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface MobileAmountInputProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
  isOverspent?: boolean;
}

const formatNumber = (value: string | undefined) => {
  if (!value) return '';
  const parsed = parseFloat(value.replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const numpadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export const MobileAmountInput = ({
  open,
  onOpenChange,
  value,
  onChange,
  onDone,
  isOverspent,
}: MobileAmountInputProps) => {
  const [rawValue, setRawValue] = useState('');

  useEffect(() => {
    if (open) {
      setRawValue(value ? value.replace(/,/g, '') : '');
    }
  }, [open, value]);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setRawValue(prev => prev.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (rawValue.includes('.')) return;
      if (!rawValue) {
        setRawValue('0.');
        return;
      }
      setRawValue(prev => prev + '.');
      return;
    }
    // Digit key
    setRawValue(prev => prev + key);
  };

  const handleDone = () => {
    if (!rawValue || parseFloat(rawValue) === 0) return;
    onChange(formatNumber(rawValue));
    onDone();
  };

  const displayAmount = formatNumber(rawValue);
  const isEmpty = !rawValue || parseFloat(rawValue) === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-background z-50">
        <div className="px-6 pt-4 pb-8 flex flex-col gap-6">
          {/* Amount Display */}
          <div className="flex flex-col items-center justify-center py-6 min-h-[100px]">
            <span className="text-sm font-medium text-muted-foreground mb-2">Rp</span>
            <div className={cn(
              "font-bold text-foreground text-center transition-all leading-tight",
              displayAmount.length > 12 ? "text-3xl" : displayAmount.length > 8 ? "text-4xl" : "text-5xl"
            )}>
              {displayAmount || '0'}
            </div>
            {isOverspent && (
              <div className="flex items-center gap-1 mt-3 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                <AlertCircle className="h-3 w-3" /> Insufficient Balance
              </div>
            )}
          </div>

          {/* Numpad */}
          <div className="flex flex-col gap-3 items-center">
            {numpadRows.map((row, ri) => (
              <div key={ri} className="flex gap-3 justify-center">
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "h-16 w-16 rounded-full text-xl font-semibold transition-all active:scale-90 select-none",
                      key === '⌫'
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : key === '.'
                        ? "bg-card text-foreground shadow-sm border border-border/50 hover:bg-accent"
                        : "bg-card text-foreground shadow-sm border border-border/50 hover:bg-accent"
                    )}
                    onClick={() => {
                      handleKey(key);
                      if (navigator.vibrate) navigator.vibrate(10);
                    }}
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* Done Button */}
          <button
            type="button"
            disabled={isEmpty}
            className={cn(
              "w-full h-14 rounded-full text-base font-semibold transition-all select-none",
              isEmpty
                ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
                : "bg-primary text-primary-foreground shadow-lg active:scale-[0.98] hover:opacity-90"
            )}
            onClick={handleDone}
          >
            Done
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add components/mobile-amount-input.tsx
git commit -m "feat: add MobileAmountInput component with numpad bottom sheet"
```

---

### Task 2: Integrate MobileAmountInput into TransactionFormFields (main amount)

**Files:**
- Modify: `components/TransactionDrawer.tsx`

- [ ] **Step 4: Add import and state in TransactionFormFields**

Add the import at the top of the file (near line 73):

```tsx
import { MobileAmountInput } from './mobile-amount-input';
```

Inside `TransactionFormFields` component (after line 870, near other `useState`/`useRef` calls), add the bottom sheet state:

```tsx
const [amountSheetOpen, setAmountSheetOpen] = useState(false);
```

- [ ] **Step 5: Replace mobile amount input with trigger card + MobileAmountInput**

Replace the mobile amount field in `TransactionFormFields` (lines 922-972, the `isMobile` branch of the amount `FormField`):

```tsx
                  {isMobile ? (
                      <div className="relative flex flex-col items-center justify-center py-4">
                        <button
                          type="button"
                          className="flex items-start justify-center gap-1 text-foreground outline-none"
                          onClick={() => setAmountSheetOpen(true)}
                        >
                            <span className="text-lg font-medium text-muted-foreground mt-2">Rp</span>
                            <div className={cn(
                                "h-auto p-0 text-5xl font-bold text-center border-none shadow-none focus-visible:ring-0 bg-transparent transition-colors",
                                isOverspent ? "text-destructive" : "text-foreground"
                            )}>
                                {field.value || '0'}
                            </div>
                        </button>
                        {isOverspent && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-destructive text-xs font-medium bg-destructive/10 px-3 py-1 rounded-full">
                                <AlertCircle className="h-3 w-3" /> Insufficient Balance
                            </div>
                        )}
                        <div className="h-1 w-16 bg-primary/20 rounded-full mt-4" />

                        <MobileAmountInput
                          open={amountSheetOpen}
                          onOpenChange={setAmountSheetOpen}
                          value={field.value || ''}
                          onChange={field.onChange}
                          onDone={() => setAmountSheetOpen(false)}
                          isOverspent={isOverspent}
                        />
                      </div>
                  ) : (
                    <Input
                        placeholder="0"
                        inputMode="numeric"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(formatNumber(value));
                        }}
                    />
                  )}
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit --pretty`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add components/TransactionDrawer.tsx
git commit -m "feat: integrate MobileAmountInput into main transaction form"
```

---

### Task 3: Integrate MobileAmountInput into SplitEditorDrawer (split item amounts)

**Files:**
- Modify: `components/SplitEditorDrawer.tsx`

- [ ] **Step 8: Add import and state in SplitEditorDrawer mobile**

Add import near line 33:

```tsx
import { MobileAmountInput } from './mobile-amount-input';
```

Inside `SplitEditorContent`, before the return (around line 117), add the state:

```tsx
const [activeSplitAmount, setActiveSplitAmount] = useState<{ index: number; value: string } | null>(null);
```

- [ ] **Step 9: Replace mobile split item amount input with tappable card**

In the mobile branch of SplitEditorContent (around lines 169-203), replace the amount `FormField`:

```tsx
                             {/* Amount Input */}
                              <FormField
                                 control={form.control}
                                 name={`splits.${index}.amount`}
                                 render={({ field }) => (
                                     <FormItem>
                                         <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
                                             <button
                                               type="button"
                                               className="w-full flex items-center gap-4 outline-none"
                                               onClick={() => setActiveSplitAmount({ index, value: field.value || '' })}
                                             >
                                                 <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                                                     <span className="font-serif font-bold text-sm">Rp</span>
                                                 </div>
                                                 <div className="flex-1 text-left">
                                                     <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                                                     <p className={cn(
                                                       "font-bold text-xl",
                                                       field.value ? "text-foreground" : "text-muted-foreground/50"
                                                     )}>
                                                       {field.value || '0'}
                                                     </p>
                                                 </div>
                                             </button>
                                         </div>
                                         <FormMessage />
                                     </FormItem>
                                 )}
                             />
```

- [ ] **Step 10: Render MobileAmountInput for split items**

After the closing `</div>` of the outer container (before `</div>` at line 410), add the shared MobileAmountInput:

```tsx
          <MobileAmountInput
            open={activeSplitAmount !== null}
            onOpenChange={(open) => {
              if (!open) setActiveSplitAmount(null);
            }}
            value={activeSplitAmount?.value || ''}
            onChange={(val) => {
              if (activeSplitAmount !== null) {
                form.setValue(`splits.${activeSplitAmount.index}.amount`, val as any);
              }
            }}
            onDone={() => setActiveSplitAmount(null)}
          />
```

- [ ] **Step 11: Verify build**

Run: `npx tsc --noEmit --pretty`
Expected: No type errors

- [ ] **Step 12: Commit**

```bash
git add components/SplitEditorDrawer.tsx
git commit -m "feat: integrate MobileAmountInput into split editor drawer"
```

---

### Task 4: Final verification

- [ ] **Step 13: Verify full build**

Run: `npx tsc --noEmit --pretty`
Expected: No type errors

Run: `npm run lint`
Expected: No lint errors

- [ ] **Step 14: Manual smoke test**

1. `npm run dev`
2. Open in mobile viewport
3. Tap FAB → TransactionDrawer opens
4. Tap amount area → MobileAmountInput bottom sheet opens
5. Tap digits → amount updates with thousand separators
6. Tap ⌫ → last digit removed
7. Tap . → decimal inserted (only once)
8. Tap Done → sheet closes, form amount updated
9. Tap split toggle → SplitEditorDrawer opens
10. Tap a split item amount → MobileAmountInput opens
11. Enter amount, tap Done → split item amount updated, summary card recalculates

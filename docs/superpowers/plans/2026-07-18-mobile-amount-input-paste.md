# MobileAmountInput Paste Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add clipboard paste support to the MobileAmountInput numpad via long press on the display amount area.

**Architecture:** Single-file change to `components/mobile-amount-input.tsx`. Add `onPointerDown`/`onPointerUp` long press detection, `navigator.clipboard.readText()` for clipboard access, a `parseClipboardAmount()` helper for sanitizing pasted values, and `sonner` toast for feedback.

**Tech Stack:** React 19, sonner (toast), Clipboard API

---

### Task 1: Add paste functionality to MobileAmountInput

**Files:**
- Modify: `components/mobile-amount-input.tsx`

- [ ] **Step 1: Add `useRef` import and `toast` import**

Add to the imports at the top of `components/mobile-amount-input.tsx`:

```tsx
"use client";

import { useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
```

- [ ] **Step 2: Add `parseClipboardAmount` helper function**

Add this function after the existing `formatNumber` function (after line 26):

```tsx
const MAX_AMOUNT = 99_999_999_999;

const parseClipboardAmount = (text: string): string | null => {
  const cleaned = text.replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  if (num > MAX_AMOUNT) return formatNumber(String(MAX_AMOUNT));
  const hasDecimal = cleaned.includes('.');
  if (hasDecimal) {
    const [intPart, decPart] = cleaned.split('.');
    return formatNumber(intPart) + '.' + decPart.slice(0, 2);
  }
  return formatNumber(cleaned);
};
```

- [ ] **Step 3: Add long press state and handler inside the component**

Inside the `MobileAmountInput` component, after `const rawValue = value.replace(/,/g, '');`, add:

```tsx
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        toast.info('Nothing to paste');
        return;
      }
      const formatted = parseClipboardAmount(text.trim());
      if (!formatted) {
        toast.error('Invalid amount');
        return;
      }
      onChange(formatted);
      if (navigator.vibrate) navigator.vibrate(10);
      toast.success('Amount pasted');
    } catch {
      toast.error('Clipboard access denied');
    }
  };

  const handlePointerDown = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      handlePaste();
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
```

- [ ] **Step 4: Attach long press handlers to display amount div**

Replace the display amount `<div>` (currently around line 91-96) to add the pointer handlers and hint text:

```tsx
            <div
              className={cn(
                "font-bold text-foreground text-center transition-all leading-tight cursor-pointer select-none",
                displayAmount.length > 12 ? "text-2xl" : displayAmount.length > 8 ? "text-3xl" : "text-4xl"
              )}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              {displayAmount || '0'}
            </div>
            {!rawValue && (
              <span className="text-[10px] text-muted-foreground/60 mt-1 animate-pulse">
                Long press to paste
              </span>
            )}
```

- [ ] **Step 5: Clean up timer on unmount**

Add a `useEffect` for cleanup. Place it after the handler definitions (after `handlePointerUp`):

```tsx
  import { useEffect, useRef } from "react";
```

And add inside the component:

```tsx
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);
```

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add components/mobile-amount-input.tsx
git commit -m "feat: add clipboard paste to MobileAmountInput via long press"
```

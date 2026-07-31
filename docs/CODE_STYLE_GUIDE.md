# Code Style Guide

## General
- **Language:** TypeScript (Strict mode).
- **Indentation:** 2 Spaces.
- **Semicolons:** Yes.

## Naming Conventions
- **Files/Components:** `PascalCase` (e.g., `TransactionDrawer.tsx`).
- **Directories:** `kebab-case` (e.g., `app/transaction-list/`).
- **Convex Functions:** `camelCase` (e.g., `getBudgetStatus`, `archiveAccount`).
- **Variables:** `camelCase`.
- **Database Tables:** `camelCase` (plural) (e.g., `transactions`, `householdMembers`). *Note: Logs or history tables may use singular (e.g., `goalHistory`).*
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `TRANSACTION_TYPES.EXPENSE`).

## Component Structure
```tsx
'use client' // If using hooks

import { useState, useRef } from 'react'
import { Loader2 } from '@/components/ui/icons'
// Imports...

// 1. Types
type Props = { ... }

// 2. Component
export default function ComponentName({ open, onOpenChange }: Props) {
  // 3. Hooks (Query/Mutation/State)
  const data = useQuery(...)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardDialog, setShowDiscardDialog] = useState(false)
  const submitLock = useRef(false)
  
  // 4. Lifecycle (Reset locks on open)
  // Essential for Drawers/Dialogs to prevent "stuck" loading states
  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      
      // History Push for Back Button Handling
      window.history.pushState({ drawer: 'component-name' }, '', window.location.href);
      
      const handlePopState = () => {
        if (isDirty) {
          window.history.pushState({ drawer: 'component-name' }, '', window.location.href);
          setShowDiscardDialog(true);
        } else {
          onOpenChange(false);
        }
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [open, isDirty, onOpenChange]);

  // 5. Handlers
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowDiscardDialog(true);
      return;
    }
    onOpenChange(newOpen);
  };
  const handleSubmit = async () => {
    // Synchronous Lock (Double-click prevention)
    if (submitLock.current || isProcessing) return;
    
    try {
        submitLock.current = true;
        setIsProcessing(true);
        if (navigator.vibrate) navigator.vibrate(10); // Haptics
        
        // ... Logic ...
        
        // Success
        onOpenChange(false);
    } catch (e) {
        // Reset on error
        submitLock.current = false;
        setIsProcessing(false);
    }
  }

  // 6. Render
  return (
    <Button disabled={isProcessing}>
        {isProcessing ? <Loader2 className="animate-spin" /> : "Save"}
    </Button>
  )
}
```

### Pattern: Step State for Success View (Expense Create)
For expense creation flows, the drawer uses a `step` state to transition from form to success view instead of closing immediately:

```tsx
const [step, setStep] = useState<"form" | "success">("form")
const [savedData, setSavedData] = useState<SuccessData | null>(null)

// In submit handler — on success:
setSavedData({ category, remaining, ... })
setStep("success")
setIsProcessing(false)
submitLock.current = false
// Don't reset isDirty here — it was already reset after successful save

// handleDismiss wrapped in useCallback for stable timer reference
const handleDismiss = useCallback(() => {
  onOpenChange(false)
}, [onOpenChange])

// Auto-dismiss via useEffect watching step
useEffect(() => {
  if (step === "success") {
    const timer = setTimeout(handleDismiss, 3000)
    return () => clearTimeout(timer)
  }
}, [step, handleDismiss])
```

**Rules:**
- Reset `isDirty` on save success (prevents discard dialog on dismiss).
- Use `useCallback` for `handleDismiss` to stabilize `useEffect` timer reference.
- Categories without budget entries: skip from overall remaining, no category row.
- Budget feedback computed via `computeBudgetStatus()` from `lib/budget-feedback.ts`.

## Reusable Components

Certain UI patterns are standardized to ensure consistency.

1.  **Date Picker:**
    - **Do NOT** implement manual `Popover` + `Calendar` logic.
    - **ALWAYS** use the standardized component: `import { DatePicker } from '@/components/ui/date-picker'`.
    - Features: Includes Year/Month dropdown navigation by default.
    - Usage:
      ```tsx
      <DatePicker 
        date={field.value} 
        setDate={field.onChange} 
        disabled={(date) => date > new Date()} 
      />
      ```

2.  **EmptyState (`@/components/ui/empty-state`):**
    - Use for ALL "no data" scenarios. Never render a bare empty `div` or a hardcoded empty message.
    - Props: `icon`, `title?`, `description` (required), `action?` (`{ label, href? | onClick? }`), `secondaryAction?`, `variant?`.
    - Variant rules:
      - `variant="illustrated"` — large icon + generous padding. **Page-level** empty states (entire page has no data).
      - `variant="compact"` — small padding/text. **Widgets, sections, and embedded** empty states (dashboard widgets, inside drawers, cards).
      - `variant="default"` (or omit) — standard in-between size.
    - The legacy `compact` boolean prop still works but is deprecated → use `variant="compact"`.
    - Always provide a clear Call to Action (`action`) when a recovery path exists (e.g., "Add Expense" opens the transaction drawer).

3.  **ErrorState (`@/components/ui/error-state`):**
    - Use for query/data loading failures, typically as an `ErrorBoundary` fallback or inside a widget.
    - Props: `icon?` (defaults to `AlertCircle`), `title` (**required**), `description?`, `action?` (`{ label, onClick }` for Retry), `secondaryAction?`.
    - **`title` is required** — describe what happened in plain language. A bare `<ErrorState />` with no props is a type error.
    - Errors must answer **"How can I recover?"** — pair the title with a retry `action` and/or a `description` explaining the likely cause.
    - Do NOT replace the whole screen when the failure is contained to one widget — render the ErrorState inline within that widget.

4.  **ErrorBoundary (`@/components/ui/error-boundary`):**
    - Wrap every screen's content area and major widget groups: `<ErrorBoundary fallback={<ErrorState title="..." description="..." action={...} />}>`.
    - Use a specific `title` per fallback context — avoid repeating the same generic message everywhere.

5.  **Loading states:**
    - Always show a Skeleton while query data is undefined — never a blank screen or an empty state flash.
    - Guard order in render: `skeleton` while `=== undefined` → `EmptyState` when list is `[]` → `ErrorBoundary`/`ErrorState` on failure → content.

6.  **Helper text (`FormDescription`):**
    - Add `FormDescription` inside a `FormItem` ONLY when it provides real guidance the label alone doesn't convey (e.g., budget reset timing). Do not repeat the label.

## Backend (Convex) Best Practices

1.  **Validation is Mandatory:**
    Always use `args: { ... }` with `v.string()`, `v.number()`, etc. Never use `any` unless absolutely necessary for JSON blobs.

2.  **Centralized Logic (CRITICAL):**
    - **Do NOT write manual calculation logic** for Spending, Unassigned Cash, or Budget Remaining in your queries.
    - **ALWAYS import helpers** from `convex/lib/finance.ts`.
        - `calculateSpendingByCategory`
        - `calculateUnassignedCash`
        - `isLiquidAccount`
    - This ensures data consistency across the app.

3.  **Authorization:**
    - **Do NOT write manual DB checks** for household membership.
    - **ALWAYS import auth helpers** from `convex/lib/auth.ts`.
        - `await ensureHouseholdAccess(ctx, householdId, userId)` (Throws Error)
        - `await checkHouseholdAccess(ctx, householdId, userId)` (Returns Boolean)
    - **Internal Mutations:** For Cron jobs or background tasks that run without a user session, use `internalMutation`.

4.  **Constants & Types:**
    - **Do NOT use magic strings** like `'expense'`, `'saving'`, `'ASSET'`.
    - **ALWAYS import constants** from `convex/lib/constants.ts`.
        - `TRANSACTION_TYPES.EXPENSE`
        - `ACCOUNT_TYPES.ASSET`

5.  **Date Handling:**
    - Store dates as ISO Strings (`v.string()`) in the database (e.g., `2023-12-25T10:00:00Z`).
    - Manipulate dates in TS using `Date` object or `date-fns`.
    - **Timezone Rule:** Backend MUST use `getServerNow(timezone)` instead of `new Date()` whenever creating or comparing dates that represent "now" for a user. The timezone comes from `household.timezone` (IANA string). **Never** use `new Date().toISOString()` or `new Date().getTime()` directly in any backend mutation/query — always route through `getServerNow(timezone)`.
      - **Fiscal period queries:** `getServerNow(timezone)` → `getFiscalDateDetails` → determine current year/month
      - **Transaction timestamps** (Initial Balance, goal completion, goal reset dates, cron auto-save): use `getServerNow(timezone).toISOString()`
      - **Recurring expense overdue logic** (`getRecurringSummary`): use `getServerNow(timezone).getDate()` for `currentDay`
      - **Cron auto-save** (`processDueSchedules`): compute transaction date by applying the timezone offset at `schedule.nextRunAt` (not `Date.now()`) to handle DST transitions correctly
    - **Frontend Date Normalization:** When sending dates to the backend (e.g., Transaction Date, Goal Target Date), always normalize time to **12:00 PM (Noon)** local time to prevent UTC conversion shifts.

6.  **Number Handling:**
    - We currently store Amounts as `v.string()` to prevent float precision issues in the DB (Legacy decision).
    - **Rule:** When performing calculations, always sanitize: `parseFloat(amount.replace(/,/g, '') || '0')`.
    - **Formatting:** Use `new Intl.NumberFormat('en-US').format(val)`.

7.  **Performance & Queries:**
    - **Batch Fetching:** Never use `await ctx.db.get()` inside a `map` or loop when processing a list. Use `Promise.all` to fetch all related documents in parallel (Batch Pattern).
    - **Indexed Queries:** Always use `.withIndex()` for lookups on indexed fields (e.g., `by_merchantId`, `by_householdId`). Never use `.filter()` without an index on large tables.
    - **Delete Guards:** When deleting a parent entity, use an indexed query to check for child references before deletion (e.g., check transactions before deleting a merchant).

8.  **Merchant Patterns:**
    - **Icon Types:** Merchants support 3 icon types stored as `v.string()`:
      - Emoji: Native character (e.g., `☕`).
      - Letter Avatar: First letter of name (e.g., `S` for Starbucks).
      - Brand Icon: Full Iconify SVG URL (e.g., `https://api.iconify.design/simple-icons/starbucks.svg`).
    - **Create Flow:** Use `MerchantCombobox` for inline creation (first-letter icon auto-assigned). Use `MerchantDrawer` for full customization.
    - **Delete Guard:** Always check `by_merchantId` index before deleting a merchant to prevent breaking transaction references.

## Motion & Animation

Semua animasi pakai **Framer Motion**. Variasi reusable ada di `lib/animations.ts`.

### Pattern: Staggered Field Entrance (Drawer)
```tsx
import { motion } from "framer-motion"
import { drawerFieldStagger, drawerFieldItem } from "@/lib/animations"

// Wrap form fields container
<motion.div variants={drawerFieldStagger} initial="hidden" animate="visible">
  <motion.div variants={drawerFieldItem}> {/* Each field */}
    <Input ... />
  </motion.div>
</motion.div>
```

### Pattern: Press Feedback (Buttons)
```tsx
// Button wrapped in motion.div — never use motion.button (invalid in framer-motion v12)
<motion.div whileTap={{ scale: 0.97 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
  <Button type="submit" disabled={isProcessing}>
    {isProcessing ? <Loader2 className="animate-spin" /> : "Save"}
  </Button>
</motion.div>
```

### Pattern: Pulse on Value Change
```tsx
import { useAnimation } from "framer-motion"

const controls = useAnimation()

const triggerPulse = useCallback(() => {
  controls.start({ scale: [1, 1.06, 1], transition: { duration: 0.25 } })
}, [controls])

// Trigger on input change
useEffect(() => { if (displayAmount) triggerPulse() }, [displayAmount])

// Wrap target element
<motion.div animate={controls}>
  <div className="text-4xl">{displayAmount}</div>
</motion.div>
```

### Rules
- **Jangan pakai `motion.button`** — framer-motion v12 tidak punya. Wrap Button dengan `motion.div`.
- **Jangan pakai `AnimatePresence` untuk input value changes** — menyebabkan remount/remount focus loss. Pakai `useAnimation` controls.
- **Variants:** Selalu import dari `lib/animations.ts`, jangan define inline.
- **Spring params:** `type: "spring"`, stiffness 400-500, damping 15 untuk press feedback. Stiffness 300, damping 20 untuk field entrance.

## Frontend Logic

1.  **State Management:**
    - Prefer URL State (Query Params) for filters/tabs.
    - Prefer Local State (`useState`) for UI toggles (Drawer open/close).
    - Prefer Server State (Convex) for data. Avoid global stores (Redux/Zustand) unless complex.

2.  **Clean Code:**
    - Extract sub-components if a file exceeds 300 lines.
    - **Directory Structure:** If a feature requires multiple specific sub-components (e.g., Dashboard widgets), group them in a subdirectory: `components/dashboard/WidgetName.tsx`.
    - Keep "Presentation" separate from "Logic" where possible, or use Custom Hooks.

3.  **Formatting Standard:**
    - **Currency:** ALWAYS use `formatCurrency(value, options)` from `@/lib/utils`.
        - **Do NOT** manually implement `Intl.NumberFormat` or `.toLocaleString()` in components.
        - This ensures consistent styling (e.g., no decimals) and centrally handles **Privacy Mode** masking (`••••`) via the optional `{ isPrivacyMode: true }` parameter.
    - **Parsing:** ALWAYS use `parseAmount(value)` from `@/lib/utils` when converting string inputs/database values to numbers for calculation. This safely handles commas and empty strings.
    - **Thousand Separators:** Ensure all numeric inputs in forms are formatted using the helper `formatNumber` (local to Drawer) or similar patterns to keep separators visible during typing.

4.  **Notifications:**
    - **In-App:** Use `sonner` (`toast.success(...)`).
    - **Push:** Use `web-push` logic via Convex Actions.
    - **Notification Click Handler (`custom-sw.js`):**
      - Always use `clients.matchAll({ type: 'window', includeUncontrolled: true })` to find an existing PWA window.
      - Focus the existing window with `client.focus()` then navigate with `client.navigate(url)`.
      - Only fall back to `clients.openWindow(url)` when no PWA window is open.
      - Always return the navigate promise from the `.then()` callback so `event.waitUntil()` properly waits for navigation.
      - The push payload must include a `url` field for deep linking; store it in `notification.data`.

5.  **Refactoring & Reusability (New):**
    - **Complex Logic:** Move heavy calculation or state logic (like Goal Projections) into custom hooks in `@/hooks` (e.g., `useGoalCalculator`).
    - **Shared Form UI:** Extract repetitive form sections (like Auto-Save toggles) into `@/components/forms`.
    - **Mobile UI:** Use dedicated mobile components from `@/components/ui/mobile-inputs` for complex inputs (Drawers simulating Selects) on small screens.
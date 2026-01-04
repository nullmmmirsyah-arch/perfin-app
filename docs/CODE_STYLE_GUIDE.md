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
- **Database Tables:** `camelCase` (plural) (e.g., `transactions`, `householdMembers`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `TRANSACTION_TYPES.EXPENSE`).

## Component Structure
```tsx
'use client' // If using hooks

import { useState } from 'react'
// Imports...

// 1. Types
type Props = { ... }

// 2. Component
export default function ComponentName({ ... }: Props) {
  // 3. Hooks (Query/Mutation/State)
  const data = useQuery(...)
  
  // 4. Handlers
  const handleSubmit = () => { ... }

  // 5. Render
  return (
    <div>...</div>
  )
}
```

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

4.  **Constants & Types:**
    - **Do NOT use magic strings** like `'expense'`, `'saving'`, `'ASSET'`.
    - **ALWAYS import constants** from `convex/lib/constants.ts`.
        - `TRANSACTION_TYPES.EXPENSE`
        - `ACCOUNT_TYPES.ASSET`

5.  **Date Handling:**
    - Store dates as ISO Strings (`v.string()`) in the database (e.g., `2023-12-25T10:00:00Z`).
    - Manipulate dates in TS using `Date` object or `date-fns`.

6.  **Number Handling:**
    - We currently store Amounts as `v.string()` to prevent float precision issues in the DB (Legacy decision).
    - **Rule:** When performing calculations, always sanitize: `parseFloat(amount.replace(/,/g, '') || '0')`.
    - **Formatting:** Use `new Intl.NumberFormat('en-US').format(val)`.

7.  **Performance & Queries:**
    - **Batch Fetching:** Never use `await ctx.db.get()` inside a `map` or loop when processing a list. Use `Promise.all` to fetch all related documents in parallel (Batch Pattern).

## Frontend Logic

1.  **State Management:**
    - Prefer URL State (Query Params) for filters/tabs.
    - Prefer Local State (`useState`) for UI toggles (Drawer open/close).
    - Prefer Server State (Convex) for data. Avoid global stores (Redux/Zustand) unless complex.

2.  **Clean Code:**
    - Extract sub-components if a file exceeds 300 lines.
    - **Directory Structure:** If a feature requires multiple specific sub-components (e.g., Dashboard widgets), group them in a subdirectory: `components/dashboard/WidgetName.tsx`.
    - Keep "Presentation" separate from "Logic" where possible, or use Custom Hooks.

3.  **Notifications:**
    - **In-App:** Use `sonner` (`toast.success(...)`).
    - **Push:** Use `web-push` logic via Convex Actions.
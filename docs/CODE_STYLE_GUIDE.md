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

2.  **Auth Guards:**
    ```typescript
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    ```

3.  **Household Security:**
    Always verify that `identity.subject` is a member of `args.householdId` before returning data. Use the `ensureHouseholdAccess` helper pattern.

4.  **Date Handling:**
    - Store dates as ISO Strings (`v.string()`) in the database (e.g., `2023-12-25T10:00:00Z`).
    - Manipulate dates in TS using `Date` object or `date-fns`.

5.  **Number Handling:**
    - We currently store Amounts as `v.string()` to prevent float precision issues in the DB (Legacy decision).
    - **Rule:** When performing calculations, always sanitize: `parseFloat(amount.replace(/,/g, '') || '0')`.
    - **Formatting:** Use `new Intl.NumberFormat('en-US').format(val)`.

## Frontend Logic

1.  **State Management:**
    - Prefer URL State (Query Params) for filters/tabs.
    - Prefer Local State (`useState`) for UI toggles (Drawer open/close).
    - Prefer Server State (Convex) for data. Avoid global stores (Redux/Zustand) unless complex.

2.  **Clean Code:**
    - Extract sub-components if a file exceeds 300 lines.
    - Keep "Presentation" separate from "Logic" where possible, or use Custom Hooks.

3.  **Notifications:**
    - **In-App:** Use `sonner` (`toast.success(...)`).
    - **Push:** Use `web-push` logic via Convex Actions.

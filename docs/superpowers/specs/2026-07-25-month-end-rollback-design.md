# Month-End Rollback Mechanism Design

## Overview

Add ability to undo the last month-end process. User can restore budget fields (`sweptAmount`, `carryoverAmount`) to their previous state and delete any budgets created during rollover.

## Requirements

- **Scope**: Undo the last process only (not all historical processes)
- **UI**: Subtle banner on budgets page with Undo button
- **Expiry**: Available until next month-end process (snapshot overwritten)
- **Data**: Only budget field patches — no transactions to undo

## Schema — `monthEndSnapshots` table

```
monthEndSnapshots:
  - _id: ID
  - userId: Id<"users">
  - householdId: optional Id<"households">
  - month: number (0-11)
  - year: number
  - sweptBudgets: [{ budgetId: Id<"budgets">, previousSweptAmount: string }]
  - rolledOverBudgets: [{ budgetId: Id<"budgets">, previousCarryoverAmount: string }]
  - insertedBudgets: [Id<"budgets">] (budget baru yang di-insert saat rollover)
  - createdAt: string (ISO)
```

## Mutation Logic

### `processMonthEnd` (modified)

1. Query budgets untuk month yang akan diproses
2. Simpan `previousSweptAmount` dan `previousCarryoverAmount` untuk setiap budget (sebelum patch)
3. Jalankan sweep (patch `sweptAmount`)
4. Jalankan rollover (patch `carryoverAmount` DAN insert budget baru jika perlu)
5. **Setelah** rollover selesai, query lagi target budgets untuk dapat `insertedBudgets` ID
6. Insert `monthEndSnapshots` record dengan semua data
7. `recomputeUserCache`
8. Return `{ sweptCount, rolloverCount }`

### `rollbackMonthEnd` (new)

```
Input: { householdId }
Logic:
1. Find latest monthEndSnapshots untuk user/household
2. Kalau tidak ada → return error "No rollback available"
3. Untuk sweptBudgets → patch budget.sweptAmount = previousSweptAmount
4. Untuk rolledOverBudgets → patch budget.carryoverAmount = previousCarryoverAmount
5. Untuk insertedBudgets → delete budget record
6. Delete snapshot record
7. recomputeUserCache
8. Return { rolledBack: true }
```

## UI — Banner di Budgets Page

### Banner (subtle, below header)

```
┌─────────────────────────────────────────────────┐
│ ↩ Month-end processed. [Undo last process]      │
└─────────────────────────────────────────────────┘
```

- Banner muncul kalau ada `monthEndSnapshots` untuk user/household
- Klik "Undo last process" → muncul AlertDialog

### Confirmation Dialog

```
┌─────────────────────────────────────────────────┐
│ ⚠ Undo Month-End Process                       │
│                                                 │
│ This will reverse the last month-end process:   │
│ • [N] categories will have their swept amounts  │
│   reset to previous values                      │
│ • [N] categories will have their carryover      │
│   amounts restored to previous values           │
│ • [N] budgets created during rollover will      │
│   be deleted                                    │
│                                                 │
│ This action cannot be undone.                   │
│                                                 │
│         [Cancel]    [Undo Process]              │
└─────────────────────────────────────────────────┘
```

- "Undo Process" button pakai destructive style
- Info spesifik: berapa kategori, berapa budget yang di-restore

## Data Flow

```
Budgets Page
  ├── useQuery(monthEndSnapshots.getLatest) → snapshot
  │     └── Banner tampil kalau snapshot ada
  └── useMutation(monthEndSnapshots.rollback) → rollback
        ├── Restore sweptAmount dari snapshot
        ├── Restore carryoverAmount dari snapshot
        ├── Delete inserted budgets
        └── Delete snapshot

Month-End Page (processMonthEnd)
  ├── Save snapshot SEBELUM proses
  │     ├── sweptBudgets: [{ budgetId, previousSweptAmount }]
  │     ├── rolledOverBudgets: [{ budgetId, previousCarryoverAmount }]
  │     └── insertedBudgets: [budgetId]
  └── Jalankan sweep/rollover seperti biasa
```

## File Changes

| File | Action |
|------|--------|
| `convex/schema.ts` | Add `monthEndSnapshots` table |
| `convex/monthEndSnapshots.ts` | New: `getLatest`, `save`, `rollback`, `delete` |
| `convex/budgets.ts` | Modify `processMonthEnd`: save snapshot sebelum proses |
| `app/budgets/page.tsx` | Add undo banner + AlertDialog |

## Edge Cases

1. **User proses lagi sebelum undo** → snapshot lama di-overwrite oleh yang baru
2. **User navigasi bulan lain** → banner tetap tampil (snapshot persist di DB)
3. **User tidak pernah proses** → tidak ada banner
4. **Snapshot ada tapi budget sudah di-edit manual** → rollback restore nilai lama (mungkin tidak sesuai ekspektasi user, tapi ini edge case yang jarang terjadi)

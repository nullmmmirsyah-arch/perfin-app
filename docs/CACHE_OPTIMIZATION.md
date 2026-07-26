# Cache Optimization Guide

## Overview

The app uses a `userCaches` Convex table to store pre-computed financial aggregates, eliminating expensive full table scans on `transactions` in the 3 heaviest queries.

## Cache Table: `userCaches`

**Schema** — `convex/schema.ts:234-254`

```ts
userCaches: defineTable({
  userId: v.string(),
  householdId: v.optional(v.id("households")),
  accumulatedByCategory: v.array(v.object({
    categoryId: v.string(),
    amount: v.number(),
  })),
  unassignedCash: v.number(),
  monthlySpending: v.array(v.object({
    year: v.number(),
    month: v.number(),
    spending: v.array(v.object({
      categoryId: v.string(),
      amount: v.number(),
    })),
    totalSpent: v.number(),
  })),
  lastUpdatedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_householdId", ["householdId"]),
```

## Cache Update Strategy (Hybrid)

1. **Mutation hooks (real-time):** Every mutation that changes transactions or budgets calls `recomputeUserCache()` after the DB operation. This keeps the cache fresh.
2. ~~**Cron (drift recovery):** Every 6 hours as a safety net.~~ (Disabled. Re-enable in `convex/crons.ts` if needed.)

## API

### `convex/lib/recomputeCache.ts`

```ts
// Write — call from mutations after changing data
recomputeUserCache(ctx: MutationCtx, userId: string, householdId?: Id<"households">): Promise<void>

// Read — call from queries (returns null if cache missing)
getCache(ctx: QueryCtx, userId: string, householdId?: Id<"households">): Promise<Doc<"userCaches"> | null>
```

### What to use cache for

| Cache Field | Replaces | Used In |
|-------------|----------|---------|
| `accumulatedByCategory` | `calculateSpendingByCategory(allTransactions, ...)` | getBudgetStatus, getDashboardSummary |
| `unassignedCash` | `calculateUnassignedCash(allTransactions, allBudgets, ...)` | getBudgetStatus, getDashboardSummary, getBudgetAssistance, upsertBudget, moveBudgetFunds (via `getUnassignedCash` helper) |
| `monthlySpending` | Manual monthly spending map built from scanning all transactions | getMonthlyTrends, getDashboardSummary (obligations) |

### `getUnassignedCash` helper

Fungsi di `convex/budgets.ts` yang handle akses unassigned cash dengan benar:

```ts
// Bulan sekarang → baca dari cache (1 DB read)
// Bulan lain → hitung langsung dengan spending data (fallback)
async function getUnassignedCash(
  ctx, userId, householdId, targetMonth, targetYear, household
): Promise<number>
```

**Kenapa tidak selalu pakai cache?** Cache `unassignedCash` hanya menyimpan nilai untuk bulan fiscal saat ini (dihitung di `recomputeCache.ts:107-125`). Jika user set budget untuk bulan lain, cache tidak valid.

**Kapan pakai fallback?** Jarang — hanya saat user berinteraksi dengan bulan selain bulan sekarang (misal: set budget bulan depan, move funds bulan lalu). Untuk bulan sekarang, selalu pakai cache.

## Developer Rules

### 1. Always use cache for aggregates

If you need accumulated spending, unassigned cash, or monthly spending trends, always read from cache via `getCache()`. Never scan all transactions with `.collect()` for these computations.

### 2. Mutation hooks are mandatory

Every mutation that modifies transactions or budgets must call `recomputeUserCache()` after the DB operation:

```ts
const handler = mutation({
  handler: async (ctx, args) => {
    // ... auth, validation ...
    // ... main DB operation (insert/patch/delete) ...
    await recomputeUserCache(ctx, userId, householdId);
  },
});
```

Already implemented in:
- `convex/transactions.ts`: create, update, deleteTransaction
- `convex/budgets.ts`: upsertBudget, deleteBudget, moveBudgetFunds, sweepBudgets, rolloverBudgets, fixAllCarryovers

If you add a new mutation that affects financial data, add the hook.

### 3. Use date-range queries, not filters from full scans

Instead of fetching all transactions and filtering in-memory:

```ts
// ❌ Bad — fetches ALL rows
const allTx = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", uid)).collect();
const thisMonth = allTx.filter(tx => tx.date >= start && tx.date <= end);

// ✅ Good — index-filtered, only fetches needed rows
const thisMonth = await ctx.db.query("transactions")
  .withIndex("by_userId_date", q => q.eq("userId", uid).gte("date", start).lte("date", end))
  .collect();
```

### 4. Use `.order("desc").take(N)` for top-N queries

Instead of fetching all and sorting:

```ts
// ❌ Bad
const allTx = await ctx.db.query("transactions").withIndex("by_userId", q => q.eq("userId", uid)).collect();
const recent = allTx.sort((a, b) => b.date - a.date).slice(0, 10);

// ✅ Good
const recent = await ctx.db.query("transactions")
  .withIndex("by_userId_date", q => q.eq("userId", uid))
  .order("desc")
  .take(10)
  .collect();
```

## Recent Optimizations

### Unassigned cash validation — fix bug + optimize DB I/O (July 2026)

**Bug:** `moveBudgetFunds`, `getBudgetAssistance`, dan `upsertBudget` memanggil `calculateUnassignedCash` tanpa data spending. Akibatnya semua alokasi budget dianggap belum terpakai, unassigned terhitung terlalu kecil (bahkan negatif).

**Fix:** Buat helper `getUnassignedCash` yang:
- Bulan sekarang → baca dari `userCaches` (1 DB read)
- Bulan lain → hitung langsung dengan spending data (fallback)
- **Cache null → fall through ke direct computation** (bukan return 0)

**DB I/O impact:**
| Function | Sebelum (buggy) | Sesudah (current month, cache ada) | Sesudah (cache missing / other month) |
|----------|-----------------|------------------------------------|---------------------------------------|
| moveBudgetFunds | 3-4 queries, no spending | 1 query (cache) | 4 queries + spending |
| getBudgetAssistance | 1 query, no spending | 1 query (cache) | 4 queries + spending |
| upsertBudget | 2 queries, no spending | 2 queries (cache) | 5 queries + spending |

### `getBudgetAssistance` — 4 full scans → 0 (June 2026)

**Before:** Did 4 full-table `.collect()` calls — `transactions` (x2), `budgets` (x2).

**Fix:** Replaced with indexed month-scoped queries. Month-end proposals are now derived client-side from `budgetData.data` via `useMemo` (the `getMonthEndProposals` backend query is kept for backward compatibility only).

### `upsertBudget` — full scan → scan of expense budgets only (June 2026)

**Before:** Fetched all budgets for the user to calculate default spending power for new budgets.

**Fix:** Changed to indexed date-range query that only fetches expense-type budgets for the current fiscal period.

### 6 DB I/O optimasi budgeting (July 2026)

| Fungsi | Sebelum | Sesudah |
|--------|---------|---------|
| **moveBudgetFunds** | `by_householdId_date` tanpa `.gte/.lte` → fetch semua transaksi | `.gte/.lte` di index — hanya 1 bulan |
| **sweepBudgets** | `by_householdId` (no date) + JS filter → full scan | `by_householdId_date` + `.gte/.lte` |
| **getBudgetReport** | `by_householdId` (no date) → full scan | `by_householdId_date` + range reports |
| **getMonthEndProposals** | N sequential query per pacing category (N+1) | 1 pre-fetch + `Map.get()` O(1) — **legacy, month-end page derives client-side** |
| **getBudgetStatus** | N parallel query per saving reset category (N+1) | 1 batch query + in-memory filter |
| **getBudgetAssistance** | 3 sequential month queries | 1 range query + in-memory partition |

## Remaining Known Issues

### `getDashboardSummary` still has 2 full scans

These could not be eliminated without deeper refactoring:

1. **`allTransactions`** — needed for transfer-based fund allocation (tracks money movements between accounts across all time)
2. **`allBudgets`** — needed for obligation computation (iterates all budgets to calculate total expense/saving/debt obligations)

If performance degrades, these can be addressed by:
- Adding dedicated indexes (e.g., `by_type` for quick transfer filtering)
- Caching transfer allocations and obligation values in `userCaches`

## Migration

New deployments need `seedAllCaches` run once to populate cache for existing users:

```ts
// convex/migrations.ts
export const seedAllCaches = internalMutation({...});
```

Run from Convex Dashboard or CLI:

```bash
npx convex run migrations:seedAllCaches --prod
```

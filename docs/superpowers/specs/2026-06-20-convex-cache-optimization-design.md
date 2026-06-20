# Convex Query Cache Optimization — Design Spec

## Problem

Tiga Convex query termahal (getBudgetStatus, getDashboardSummary, getMonthlyTrends)
masing-masing melakukan **full table scan** pada tabel `transactions` (916 baris = ~358KB)
setiap kali dipanggil. Dengan data aktual:

| Query | Reads | % of total |
|-------|-------|-----------|
| getBudgetStatus | 376 KB | 34% |
| getDashboardSummary | 380 KB | 34% |
| getMonthlyTrends | 360 KB | 32% |
| **Total per load** | **1,116 KB** | |

Biaya ini berlipat karena query dipanggil puluhan-ratus kali per hari per user.

## Solution: Pre-computed Cache

Buat tabel `userCaches` yang menyimpan hasil kalkulasi berat (all-time accumulated,
unassigned cash, monthly spending summary). Query membaca cache doc + query ringan
(date-range, index-targeted) → eliminasi full table scan.

### Schema

File: `convex/schema.ts`

```ts
userCaches: defineTable({
  userId: v.string(),
  householdId: v.optional(v.id("households")),

  // All-time accumulated spending per category
  accumulatedByCategory: v.array(v.object({
    categoryId: v.string(),
    amount: v.number(),
  })),

  // Unassigned cash (current month)
  unassignedCash: v.number(),

  // Monthly spending breakdown (for trends)
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
  .index("by_householdId", ["householdId"]);
```

### Update Strategy: Hybrid

**Trigger:**
Setiap mutation yang mengubah data keuangan:

| Mutation | accumulatedByCategory | unassignedCash | monthlySpending |
|----------|----------------------|----------------|-----------------|
| transactions.create | ✓ recalc | ✓ recompute | ✓ recompute |
| transactions.update | ✓ recalc | ✓ recompute | ✓ recompute |
| transactions.delete | ✓ recalc | ✓ recompute | ✓ recompute |
| budgets.upsertBudget | — | ✓ recompute | — |
| budgets.moveBudgetFunds | — | ✓ recompute | — |
| budgets.deleteBudget | — | ✓ recompute | — |

**Accumulated calculation:**
Scan all transactions + all accounts + all categories, panggil
`calculateSpendingByCategory()` → simpan hasil.

**Unassigned cash calculation:**
Scan all transactions + all budgets + all accounts, panggil
`calculateUnassignedCash()` → simpan hasil.

**Monthly spending calculation:**
Dibangun bersamaan dengan accumulated (scan all transactions sekali),
group by year-month-categoryId → simpan array.

**Cost per recompute:**
~370KB per mutation. Dengan asumsi ~20 mutasi/hari = 7.4MB/hari.
Tanpa cache: ~100 query/hari × 380KB = 38MB/hari.
Net savings: ~30MB/hari.

### Fungsi Helper Recompute

```
convex/lib/recomputeCache.ts:
  recomputeUserCache(ctx, userId, householdId?)
```

Logic:
1. Fetch all transactions, accounts, categories, budgets
2. Build accountsMap, categoriesMap
3. Hitung accumulated: `calculateSpendingByCategory(allTransactions, accountsMap, categoriesMap)`
4. Hitung unassigned: `calculateUnassignedCash(allTransactions, allBudgets, accountsMap, startDay, categoriesMap)`
5. Hitung monthlySpending: group allTransactions by fiscal (year, month), hitung spending per category
6. Upsert ke tabel `userCaches`

### Query Optimization per Function

**getBudgetStatus:**
- ~~ALL transactions~~ → current month tx via date-range (by_userId_date / by_householdId_date)
- ~~accumulatedMap from scan~~ → dari cache doc
- ~~unassignedCash from scan~~ → dari cache doc
- Categories, accounts, budgets → tetap (ukuran kecil)
- Estimated: 376KB → **105KB (-72%)**

**getDashboardSummary:**
- ~~ALL transactions~~ → current month tx via date-range
- ~~accumulatedMap~~ → dari cache doc
- ~~unassignedCash~~ → dari cache doc
- ~~duplicate budgets fetch~~ → satu query allBudgets, filter di JS
- Accounts, categories, budgets → tetap
- Estimated: 380KB → **110KB (-71%)**

**getMonthlyTrends:**
- ~~ALL transactions~~ → dari cache doc (monthlySpending)
- ~~N+1 category name lookup~~ → batch categories query (10 docs = 2KB)
- Estimated: 360KB → **~12KB (-97%)**

**Total all 3: 1,116KB → ~117KB (-90%)**

### Cron Sync

Tambah scheduled function `cron.recomputeAllCache` yang jalan setiap jam:
- Fetch semua user yang punya data
- Panggil recomputeUserCache untuk masing-masing
- Fix any drift dari incremental updates

### Files Changed

| File | Change |
|------|--------|
| `convex/schema.ts` | + tabel userCaches |
| `convex/lib/recomputeCache.ts` | + helper (new file) |
| `convex/crons.ts` | + scheduled full recompute |
| `convex/budgets.ts:getBudgetStatus` | rewrite: use cache |
| `convex/dashboard.ts:getDashboardSummary` | rewrite: use cache |
| `convex/dashboard.ts:getMonthlyTrends` | rewrite: use cache |
| `convex/transactions.ts:create` | + recomputeCache call |
| `convex/transactions.ts:update` | + recomputeCache call |
| `convex/transactions.ts:delete` | + recomputeCache call |
| `convex/budgets.ts:upsertBudget` | + recomputeCache call |
| `convex/budgets.ts:moveBudgetFunds` | + recomputeCache call |
| `convex/budgets.ts:deleteBudget` | + recomputeCache call |

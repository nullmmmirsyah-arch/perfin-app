# Transaction Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a text search bar to the Transactions page that searches across transaction descriptions, amounts, category names, account names, and label names.

**Architecture:** New Convex query `searchTransactions` loads transactions within the current date range, batch-fetches related entities, and filters server-side using JS string matching. Frontend uses a dual-mode approach: normal paginated list when search is empty, search results when search has text.

**Tech Stack:** Next.js 16, Convex, shadcn/ui, date-fns, lucide-react

---

### Task 1: Create `useDebounce` hook

**Files:**
- Create: `hooks/use-debounce.ts`

```ts
"use client"

import { useState, useEffect } from "react"

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

- [ ] **Create the file with the code above**

- [ ] **Commit**

```
git add hooks/use-debounce.ts
git commit -m "feat: add useDebounce hook"
```

---

### Task 2: Add `searchTransactions` Convex query

**Files:**
- Modify: `convex/transactions.ts` (insert after line 593, before `export const create`)

Insert this query between `exportTransactions` (ends at line 593) and `create` (starts at line 595):

```ts
export const searchTransactions = query({
  args: {
    householdId: v.optional(v.id("households")),
    search: v.string(),
    dateRange: v.optional(v.object({
      start: v.optional(v.string()),
      end: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { householdId, search, dateRange } = args;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (!search.trim()) return [];

    let queryBuilder;
    if (householdId) {
      if (!await checkHouseholdAccess(ctx, householdId, identity.subject)) {
        return [];
      }
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_householdId_date", (q) => q.eq("householdId", householdId));
    } else {
      queryBuilder = ctx.db
        .query("transactions")
        .withIndex("by_userId_date", (q) => q.eq("userId", identity.subject));
    }

    if (dateRange?.start) {
      queryBuilder = queryBuilder.filter((q) => q.gte(q.field("date"), dateRange.start!));
    }
    if (dateRange?.end) {
      queryBuilder = queryBuilder.filter((q) => q.lte(q.field("date"), dateRange.end!));
    }

    let results = await queryBuilder.order("desc").collect();

    // Batch fetch related entities
    const accountIds = new Set<Id<"accounts">>();
    const categoryIds = new Set<Id<"categories">>();
    const labelIds = new Set<Id<"labels">>();

    results.forEach(t => {
      accountIds.add(t.accountId);
      if (t.toAccountId) accountIds.add(t.toAccountId);
      if (t.categoryId) categoryIds.add(t.categoryId);
      if (t.labelId) labelIds.add(t.labelId);
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelId) labelIds.add(s.labelId);
      });
    });

    const [accounts, categories, labels] = await Promise.all([
      Promise.all(Array.from(accountIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(categoryIds).map(id => ctx.db.get(id))),
      Promise.all(Array.from(labelIds).map(id => ctx.db.get(id))),
    ]);

    const accountMap = new Map(accounts.filter(Boolean).map(a => [a!._id, a!]));
    const categoryMap = new Map(categories.filter(Boolean).map(c => [c!._id, c!]));
    const labelMap = new Map(labels.filter(Boolean).map(l => [l!._id, l!]));

    const searchLower = search.toLowerCase();

    const matchesSearch = (t: typeof results[number]) => {
      if (t.description?.toLowerCase().includes(searchLower)) return true;
      if (t.amount.replace(/,/g, '').includes(searchLower)) return true;

      const catName = t.categoryId ? categoryMap.get(t.categoryId)?.name : undefined;
      if (catName?.toLowerCase().includes(searchLower)) return true;

      const accName = accountMap.get(t.accountId)?.name;
      if (accName?.toLowerCase().includes(searchLower)) return true;

      const lblName = t.labelId ? labelMap.get(t.labelId)?.name : undefined;
      if (lblName?.toLowerCase().includes(searchLower)) return true;

      if (t.toAccountId) {
        const toAccName = accountMap.get(t.toAccountId)?.name;
        if (toAccName?.toLowerCase().includes(searchLower)) return true;
      }

      if (t.isSplit && t.splits) {
        for (const split of t.splits) {
          if (split.description?.toLowerCase().includes(searchLower)) return true;
          const splitCatName = categoryMap.get(split.categoryId)?.name;
          if (splitCatName?.toLowerCase().includes(searchLower)) return true;
          if (split.labelId) {
            const splitLblName = labelMap.get(split.labelId)?.name;
            if (splitLblName?.toLowerCase().includes(searchLower)) return true;
          }
        }
      }

      return false;
    };

    results = results.filter(matchesSearch);

    // Sort by date descending and limit to 30
    results = results.slice(0, 30);

    // Build enriched response (same as get query)
    return results.map((transaction) => {
      const fromAccount = accountMap.get(transaction.accountId);
      const toAccount = transaction.toAccountId ? accountMap.get(transaction.toAccountId) : null;
      const label = transaction.labelId ? labelMap.get(transaction.labelId) : null;
      const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;

      const splitsWithDetails = transaction.splits?.map((split) => {
        const splitCategory = categoryMap.get(split.categoryId);
        const splitLabel = split.labelId ? labelMap.get(split.labelId) : null;
        return {
          ...split,
          categoryName: splitCategory?.name,
          labelName: splitLabel?.name,
          labelColor: splitLabel?.color,
        };
      });

      const hideAmount = transaction.isSplit && transaction.splits && transaction.splits.length > 0
        ? transaction.splits.some(s => categoryMap.get(s.categoryId)?.hideAmount === true)
        : (category?.hideAmount ?? false);

      return {
        ...transaction,
        fromAccountName: fromAccount?.name,
        toAccountName: toAccount?.name,
        categoryName: category?.name,
        hideAmount,
        label: label || null,
        splits: splitsWithDetails,
      };
    });
  },
});
```

- [ ] **Insert the query code after `exportTransactions` (after line 593, before `export const create`)**

- [ ] **Verify the file parses correctly**

Run: `node -e "require('fs').readFileSync('convex/transactions.ts', 'utf8')"` (basic syntax check)

- [ ] **Commit**

```
git add convex/transactions.ts
git commit -m "feat: add searchTransactions Convex query"
```

---

### Task 3: Add search input and dual-mode to Transactions page

**Files:**
- Modify: `app/transactions/page.tsx`

Changes:

**a) Add imports at top (after existing imports):**

```ts
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { Skeleton } from '@/components/ui/skeleton'
```

**b) Add state and debounce after existing state hooks (after `const [activeTab, setActiveTab] = useState("list")` line 40):**

```ts
const [search, setSearch] = useState("")
const debouncedSearch = useDebounce(search, 300)
```

**c) Replace the `usePaginatedQuery` call (lines 81-97) with dual-mode logic:**

Replace:
```ts
const { results: transactions, status, loadMore } = usePaginatedQuery(convexApi.transactions.get, {
    householdId: householdId ?? undefined,
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    labelId: filters.labelId,
    dateRange: filters.dateRange
      ? {
          start: filters.dateRange.from?.toISOString(),
          end: filters.dateRange.to ? (() => {
              const d = new Date(filters.dateRange.to);
              d.setHours(23, 59, 59, 999);
              return d.toISOString();
          })() : undefined,
        }
      : undefined,
}, { initialNumItems: 20 })
```

With:
```ts
const isSearching = debouncedSearch.trim().length > 0

const { results: transactions, status, loadMore } = usePaginatedQuery(
  isSearching ? "skip" : convexApi.transactions.get,
  isSearching
    ? "skip"
    : {
        householdId: householdId ?? undefined,
        type: filters.type,
        accountId: filters.accountId,
        categoryId: filters.categoryId,
        labelId: filters.labelId,
        dateRange: filters.dateRange
          ? {
              start: filters.dateRange.from?.toISOString(),
              end: filters.dateRange.to ? (() => {
                  const d = new Date(filters.dateRange.to);
                  d.setHours(23, 59, 59, 999);
                  return d.toISOString();
              })() : undefined,
            }
          : undefined,
      },
  { initialNumItems: 20 }
)

const searchResults = useQuery(
  isSearching ? convexApi.transactions.searchTransactions : "skip",
  isSearching
    ? {
        householdId: householdId ?? undefined,
        search: debouncedSearch,
        dateRange: filters.dateRange
          ? {
              start: filters.dateRange.from?.toISOString(),
              end: filters.dateRange.to ? (() => {
                  const d = new Date(filters.dateRange.to);
                  d.setHours(23, 59, 59, 999);
                  return d.toISOString();
              })() : undefined,
            }
          : undefined,
      }
    : "skip"
)

const displayTransactions = isSearching ? (searchResults ?? undefined) : transactions
```

**d) Add import for `useQuery` at the top of the file:**

Replace:
```ts
import { usePaginatedQuery, useMutation } from 'convex/react'
```

With:
```ts
import { usePaginatedQuery, useQuery, useMutation } from 'convex/react'
```

**e) Add search input UI after the filter controls (between `</div>` closing the header controls at line 164 and `<TransactionDrawer` at line 166):**

```tsx
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by description, amount, category, account, or label..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
```

**f) Update the empty state text when searching (around line 188-193):**

Replace:
```tsx
{transactions.length === 0 && (
    <div className="mt-8 p-4 border rounded-md bg-muted/50">
    <p className="text-muted-foreground">
        No transactions yet. Click &quot;Create Transaction&quot; to get started.
    </p>
    </div>
)}
```

With:
```tsx
{displayTransactions && displayTransactions.length === 0 && (
    <div className="mt-8 p-4 border rounded-md bg-muted/50">
    <p className="text-muted-foreground">
        {isSearching
            ? "No transactions matching your search."
            : "No transactions yet. Click \"Create Transaction\" to get started."}
    </p>
    </div>
)}
```

**g) Update the `TransactionListGrouped` render to use `displayTransactions`:**

Replace:
```tsx
<TransactionListGrouped 
    transactions={transactions as TransactionWithDetails[]}
```
With:
```tsx
<TransactionListGrouped 
    transactions={displayTransactions as TransactionWithDetails[]}
```

**h) Update "Load More" button to hide during search:**

Replace:
```tsx
{status === "CanLoadMore" && (
```
With:
```tsx
{!isSearching && status === "CanLoadMore" && (
```

**i) Update analytics view similarly:**

Replace:
```tsx
<TransactionAnalytics 
    transactions={transactions as TransactionWithDetails[]} 
```
With:
```tsx
<TransactionAnalytics 
    transactions={displayTransactions as TransactionWithDetails[]} 
```

Replace:
```tsx
{status === "CanLoadMore" && (
    <div className="mt-8 flex justify-center">
        <p className="text-xs text-muted-foreground">
            * Analytics currently showing only loaded transactions. 
            <Button 
                variant="link" 
                onClick={() => loadMore(50)}
                className="h-auto p-0 ml-1"
            >
                Load more data
            </Button>
        </p>
    </div>
)}
```
With:
```tsx
{!isSearching && status === "CanLoadMore" && (
    <div className="mt-8 flex justify-center">
        <p className="text-xs text-muted-foreground">
            * Analytics currently showing only loaded transactions. 
            <Button 
                variant="link" 
                onClick={() => loadMore(50)}
                className="h-auto p-0 ml-1"
            >
                Load more data
            </Button>
        </p>
    </div>
)}
```

- [ ] **Make all the above edits to `app/transactions/page.tsx`**

- [ ] **Verify build**

Run: `npx next build --webpack 2>&1 | head -50` (check for type errors)

- [ ] **Commit**

```
git add app/transactions/page.tsx
git commit -m "feat: add search bar with dual-mode to transactions page"
```

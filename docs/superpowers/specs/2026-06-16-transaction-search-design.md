# Transaction Search — Design Spec

**Date:** 2026-06-16
**Status:** Approved

## Problem

The Transactions page lacks a text search capability. Users can filter by type, account, category, label, and date range, but cannot search across transaction descriptions, amounts, or related entity names.

## Scope

Add a text search bar to the Transactions page (`/transactions`) that searches across transaction descriptions, amounts, category names, account names, and label names. This is a within-page feature, not a global command palette.

## Backend: `searchTransactions` query

**File:** `convex/transactions.ts`

New Convex query with args:

- `householdId: v.optional(v.id("households"))`
- `search: v.string()`
- `dateRange: v.optional(v.object({ start: v.optional(v.string()), end: v.optional(v.string()) }))`

**Flow:**

1. Auth check — same pattern as `get` and `exportTransactions`
2. Load all transactions using the date index (`by_userId_date` or `by_householdId_date`)
   - Apply date range filter if provided
   - Collect all matching results (no pagination — same approach as `get`)
3. Batch fetch related accounts, categories, and labels (same N+1 prevention as `get`)
4. Filter each transaction against the search string (case-insensitive includes):
   - `transaction.description`
   - `transaction.amount` (string includes — "50" matches "1,500")
   - `categoryName` from the fetched category map
   - `accountName` from the fetched account map
   - `labelName` from the fetched label map
   - For split transactions: also check each split's `description`, `categoryName`, and `labelName`
5. Denormalize into `TransactionWithDetails` format (same as `get`)
6. Return top 30 results sorted by date descending
7. If `search` is empty string, return empty array (caller should use `get` instead)

## Frontend: Search Input

**File:** `app/transactions/page.tsx`

### State

```ts
const [search, setSearch] = useState("")
const debouncedSearch = useDebounce(search, 300)
```

### Dual-mode rendering

| Condition | Hook | Pagination |
|---|---|---|
| `debouncedSearch` is empty | `usePaginatedQuery(api.transactions.get, ...)` | Yes — existing behavior |
| `debouncedSearch` is non-empty | `useQuery(api.transactions.searchTransactions, { search, householdId, dateRange })` | No — top 30 results |

### UI

- Search input placed between the header controls (Tabs + Filters) and the Carousel/TransactionListGrouped
- Uses `Input` from shadcn with `Search` icon from lucide-react
- Placeholder: "Search by description, amount, category, account, or label..."
- Loading state: small spinner inside input while Convex query is loading
- Empty state: `EmptyState` component with "No transactions matching your search."
- When search is cleared, the normal paginated list resumes automatically

### No new components needed

The search results already match the `TransactionWithDetails` type, so `TransactionListGrouped` renders them directly.

## Files Changed

1. `convex/transactions.ts` — add `searchTransactions` query
2. `app/transactions/page.tsx` — add search state, input UI, dual-mode rendering
3. (No new components, no new types, no schema changes)

## Out of Scope

- Global search / command palette
- Search on other pages (goals, accounts, etc.)
- Full-text search index in Convex (JS-side filtering is sufficient at this scale)
- Search result highlighting

# Household Privacy & Permissions Design

## Overview

Add permission boundaries and privacy controls to household sharing. Two mechanisms:

1. **Permission gates** — only admin role can create accounts, categories, and labels
2. **Privacy controls** — account-level visibility (private/shared) and category-level hideAmount for transactions

## Problem

Currently all household members see all accounts, transactions, categories, and labels. A user (admin) who shares a household with family members needs to:
- Hide certain accounts (e.g., personal savings) from other members
- Hide nominal amounts of certain transactions (e.g., salary) while keeping the transaction visible
- Prevent non-admin members from creating accounts, categories, or labels

## Design

### 1. Schema Changes

**accounts table** — add field:
```
visibility: v.optional(v.union(v.literal("shared"), v.literal("private")))
// default: "shared"
```

**categories table** — add field:
```
hideAmount: v.optional(v.boolean())
// default: false
```

No new tables. No changes to transactions, labels, budgets, or other tables.

### 2. Permission Model

| Action | Admin | Member |
|--------|-------|--------|
| Create account | ✅ | ❌ |
| Create category | ✅ | ❌ |
| Create label | ✅ | ❌ |
| Change account visibility | ✅ | ❌ |
| Change category hideAmount | ✅ | ❌ |
| Create transaction | ✅ | ✅ |
| View shared accounts | ✅ | ✅ |
| View private accounts (if owner) | ✅ | ✅ |
| View private accounts (if not owner) | ❌ | ❌ |

### 3. Account Visibility

**Visibility:**
- `"shared"` (default) — visible to all household members
- `"private"` — visible only to the account owner (userId matches)

**Where it applies:**
- Accounts list — private accounts excluded for non-owner
- Account selector in transaction form — private accounts hidden for non-owner
- Dashboard totals — private accounts excluded from liquidCash, totalSavingsOnly, totalAssetsOnly for non-owner
- Allocation map — private account allocations excluded for non-owner
- Budget breakdown — budgets linked to private accounts excluded for non-owner

**Visibility is per-account, set at create or update time:**
- Only admin can set visibility
- Default is `"shared"` when created by admin
- Admin can change visibility of any account in the household
- Mutation validates that the changer has admin role

### 4. Category hideAmount

**hideAmount:** boolean flag on categories (default: false). When `true`:
- Transactions with this category still appear in lists for all members
- Nominal amount for those transactions is replaced with `"••••"` for non-owner members
- The transaction remains visible (date, description, category, account name)
- Only the amount display is masked

**Where it applies:**
- Transaction list items (`TransactionItem.tsx`)
- Dashboard recent transactions
- Category detail page transaction history
- Report page transaction details
- Budget card transaction details

**Does NOT affect:**
- Dashboard totals — total income/expense in the period remains accurate (member trusts the total)
- Budget remaining calculation — uses real amounts for budget math
- Category spending summary — total spent per category is accurate

**Only admin can set hideAmount.** Member sees the category normally but does not see the hideAmount checkbox in the drawer.

### 5. Permission Enforcement (Backend)

**Admin check helper** — add to `convex/lib/auth.ts`:
```
async function checkAdminAccess(ctx, householdId, userId): Promise<boolean>
async function ensureAdminAccess(ctx, householdId, userId): Promise<void>
```

**Mutations that require admin:**
- `accounts:create` — add `ensureAdminAccess` check
- `accounts:update` (when changing visibility) — check admin
- `categories:create` — add `ensureAdminAccess` check
- `categories:update` (when changing hideAmount) — check admin
- `labels:create` — add `ensureAdminAccess` check

### 6. Data Filtering (Backend)

**Accounts query (`accounts:get`):**
After fetching accounts for household, filter: `a.visibility !== "private" || a.userId === identity.subject`

**Transactions query helpers:**
When fetching transactions for a household context:
1. Fetch private account IDs owned by other users
2. Filter out transactions whose `accountId` or `toAccountId` is in that set
3. For remaining transactions, check if any linked category has `hideAmount === true` and transaction userId !== current userId → mask the amount

**Dashboard (`dashboard:getDashboardSummary`):**
- Filter accounts: exclude private accounts not owned by current user
- Filter transactions: exclude transactions linked to private accounts not owned by current user
- Dashboard totals include all visible transactions (hideAmount only masks display, not totals)

### 7. Frontend Changes

**AccountDrawer:**
- Add visibility dropdown (`shared`/`private`) — only visible if user is admin
- Pass `userRole` or `isAdmin` prop from page

**CategoryDrawer:**
- Add `hideAmount` checkbox — only visible if user is admin
- Toggle hint text: "Sembunyikan nominal transaksi dari anggota lain"

**TransactionItem (display):**
- Check `hideAmount` on the transaction's category
- If true and current user !== transaction userId → display `"••••"` instead of formatted amount
- Same for split transaction items

**Pages — permission gating:**
- Accounts page: hide "+" button for members
- Categories page: hide "+" button for members
- Labels page: hide "+" button for members
- Check `userRole` via `useQuery(api.households.getMemberRole, { householdId })` or similar

**Dashboard:**
- Recent transactions: apply hideAmount masking
- Amounts in totals: no masking (total is accurate)

### 8. Edge Cases

- **Archive/Restore account:** Only admin should be able to change visibility, but archive is already allowed for any member with access. If account is private, only owner can archive it (current behavior — userId check).
- **Initial balance transaction:** Created automatically when an admin creates an account. Transaction inherits the account's household scope. No privacy issue since the account creator is the transaction owner.
- **Saving goals with linked accounts:** Saving accounts are visible per the account visibility rule. Budgets linked to private saving accounts should only show in the owner's dashboard.
- **Transfers:** Transfer between a shared account and a private account — the transaction is visible in the shared account's transaction list, but the counterparty account name may leak the private account name. On the non-owner's side, the transfer appears as "Transfer to/from Private Account" (anonymized name).
- **Split transactions:** If a transaction has multiple categories, some with hideAmount and some without — only the splits with hideAmount categories are masked. Other splits display normally.
- **Existing data migration:** All existing accounts get `visibility: "shared"`. All existing categories get `hideAmount: false`. No data loss.

### 9. Non-Goals

- Per-member visibility overrides (e.g., "member A can see this, member B cannot")
- Temporary visibility toggles
- Hiding entire accounts from the owner themselves
- Transaction-level hideAmount flag (only category-level)
- Hiding account names from transfers to private accounts (leakage is considered acceptable for v1)

### 10. Notifications

Notifications are sent to other household members when a transaction is created (`convex/transactions.ts:854`). Privacy rules:

- **Skip notification entirely** if the transaction's account is `private` and the recipient is not the owner
- **Skip notification entirely** if the transaction's category has `hideAmount: true`
- Otherwise, notification is sent normally (shared account, non-hidden category)

This prevents leaking private data via push notification body.

### 11. Testing

- Test that member cannot create account/category/label (Convex mutation throws)
- Test that private account is invisible to other household members
- Test that hideAmount masks amount for non-owner
- Test that hideAmount does not mask amount for the transaction owner
- Test that dashboard totals include hideAmount transactions in totals
- Test that hideAmount applies to split transactions correctly
- Test visibility change by admin vs member
- Test migration: existing accounts get "shared", existing categories get hideAmount false

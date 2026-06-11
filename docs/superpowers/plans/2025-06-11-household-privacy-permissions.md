# Household Privacy & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add permission boundaries (admin-only create) and privacy controls (account visibility, category hideAmount) to household sharing.

**Architecture:** Two privacy mechanisms: (1) account-level `visibility` field (`shared`/`private`) that hides entire accounts from non-owner members, (2) category-level `hideAmount` flag that masks transaction amounts with `••••` for non-owner members. Permission gates are enforced at the Convex mutation level using a new admin check helper.

**Tech Stack:** Next.js 16, Convex, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2025-06-11-household-privacy-permissions-design.md`

---

### Task 1: Schema & Constants

**Files:**
- Modify: `convex/schema.ts` — add `visibility` to accounts, `hideAmount` to categories
- Modify: `convex/lib/constants.ts` — add `ACCOUNT_VISIBILITY` constants

- [ ] **Step 1: Add ACCOUNT_VISIBILITY constants**

In `convex/lib/constants.ts`, add after `ACCOUNT_TYPES`:

```typescript
export const ACCOUNT_VISIBILITY = {
  SHARED: "shared",
  PRIVATE: "private",
} as const;

export type AccountVisibility = typeof ACCOUNT_VISIBILITY[keyof typeof ACCOUNT_VISIBILITY];
```

- [ ] **Step 2: Add visibility to accounts schema**

In `convex/schema.ts`, inside the `accounts: defineTable({...})`, add after `linkedCategoryId`:

```typescript
visibility: v.optional(v.union(v.literal("shared"), v.literal("private"))),
```

- [ ] **Step 3: Add hideAmount to categories schema**

In `convex/schema.ts`, inside the `categories: defineTable({...})`, add after `lastResetDate`:

```typescript
hideAmount: v.optional(v.boolean()),
```

- [ ] **Step 4: Verify schema compiles**

Run: `npx convex codegen`
Expected: No errors, type definitions regenerated.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/lib/constants.ts
git commit -m "feat: add visibility and hideAmount fields to schema"
```

---

### Task 2: Auth Helpers — Admin Check

**Files:**
- Modify: `convex/lib/auth.ts` — add `checkAdminAccess`, `ensureAdminAccess`

- [ ] **Step 1: Add admin check helpers**

In `convex/lib/auth.ts`, add after `ensureHouseholdAccess`:

```typescript
/**
 * Checks if a user is an admin of a household.
 */
export async function checkAdminAccess(
  ctx: QueryCtx | MutationCtx,
  householdId: Id<"households">,
  userId: string
): Promise<boolean> {
  const member = await ctx.db
    .query("householdMembers")
    .withIndex("by_householdId_userId", (q) =>
      q.eq("householdId", householdId).eq("userId", userId)
    )
    .first();
  return member?.role === "admin";
}

/**
 * Ensures a user is an admin of a household. Throws if not admin.
 */
export async function ensureAdminAccess(
  ctx: MutationCtx,
  householdId: Id<"households">,
  userId: string
): Promise<void> {
  if (!await checkAdminAccess(ctx, householdId, userId)) {
    throw new Error("Unauthorized: Admin access required.");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/auth.ts
git commit -m "feat: add admin check helpers for household permissions"
```

---

### Task 3: Backend Accounts — Visibility & Admin Gate

**Files:**
- Modify: `convex/accounts.ts`

- [ ] **Step 1: Update `get` query to filter private accounts**

In `convex/accounts.ts`, in the `get` query handler, replace the return at the end:

```typescript
// Before:
return accounts.filter(a => !a.isArchived);

// After:
return accounts.filter(a => {
  if (a.isArchived && !showArchived) return false;
  if (a.visibility === "private" && a.userId !== identity.subject) return false;
  return true;
});
```

- [ ] **Step 2: Add admin check to `create` mutation**

In `convex/accounts.ts`, in the `create` handler, after the household access check:

```typescript
// After:
if (args.householdId) {
    await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
}

// Add:
if (args.householdId) {
    await ensureAdminAccess(ctx, args.householdId, identity.subject);
}
```

- [ ] **Step 3: Add admin check and visibility update to `update` mutation**

In `convex/accounts.ts`, in the `update` handler, change the import to include `ensureAdminAccess`:

```typescript
// Change import line:
import { checkHouseholdAccess, ensureHouseholdAccess } from "./lib/auth";
// To:
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";
```

In `convex/accounts.ts`, in the `update` handler, add admin check after household access check (around line 181):

```typescript
// After:
if (account.householdId) {
    await ensureHouseholdAccess(ctx, account.householdId, identity.subject);
} else {
    if (account.userId !== identity.subject) throw new Error("Unauthorized");
}

// Add admin check for visibility change
if (args.visibility !== undefined && account.householdId) {
  await ensureAdminAccess(ctx, account.householdId, identity.subject);
}
```

Update the `update` mutation args to accept visibility:

```typescript
// Change args:
handler: async (ctx, args) => {
    const { id, targetAmount, targetDate, goalType, monthlyBudget, ...rest } = args;
// To:
handler: async (ctx, args) => {
    const { id, targetAmount, targetDate, goalType, monthlyBudget, visibility, ...rest } = args;
```

And in the `ctx.db.patch(id, { ...rest, linkedCategoryId: newLinkedCategoryId })`, add visibility:

```typescript
await ctx.db.patch(id, { ...rest, linkedCategoryId: newLinkedCategoryId, visibility: visibility ?? undefined });
```

- [ ] **Step 4: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add convex/accounts.ts
git commit -m "feat: add account visibility and admin gate on create"
```

---

### Task 4: Backend Categories — hideAmount & Admin Gate

**Files:**
- Modify: `convex/categories.ts`

- [ ] **Step 1: Add admin check to `create` mutation**

In `convex/categories.ts`, in the `create` handler, after the household access check:

```typescript
// Change import to add ensureAdminAccess:
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";

// After:
if (args.householdId) {
    await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
}
// Add:
if (args.householdId) {
    await ensureAdminAccess(ctx, args.householdId, identity.subject);
}
```

- [ ] **Step 2: Add hideAmount to `update` mutation**

In `convex/categories.ts`, in the `update` mutation, add `hideAmount` to args and the patch:

```typescript
// In handler:
const { id, goalType, monthlyBudget, hideAmount, ...rest } = args;

// In the patch:
await ctx.db.patch(id, { ...rest, goalType: goalType as any, hideAmount: hideAmount ?? undefined });
```

Also update the args validator to accept hideAmount:

```typescript
// Add to the args object:
hideAmount: v.optional(v.boolean()),
```

- [ ] **Step 3: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/categories.ts
git commit -m "feat: add hideAmount to categories and admin gate on create"
```

---

### Task 5: Backend Labels — Admin Gate on Create

**Files:**
- Modify: `convex/labels.ts`

- [ ] **Step 1: Add admin check to `create` mutation**

In `convex/labels.ts`, change import and add admin check:

```typescript
// Change import:
import { checkHouseholdAccess, ensureHouseholdAccess, ensureAdminAccess } from "./lib/auth";

// After:
if (args.householdId) {
    await ensureHouseholdAccess(ctx, args.householdId, identity.subject);
}
// Add:
if (args.householdId) {
    await ensureAdminAccess(ctx, args.householdId, identity.subject);
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/labels.ts
git commit -m "feat: add admin gate on label creation"
```

---

### Task 6: Backend Transactions — Notification Filtering

**Files:**
- Modify: `convex/transactions.ts`

- [ ] **Step 1: Skip notification for private account or hideAmount**

In `convex/transactions.ts`, in the `create` mutation handler, find the notification block (lines 842-861). Replace it:

```typescript
// Current code (lines 842-861):
if (args.householdId) {
  const members = await ctx.db
    .query("householdMembers")
    .withIndex("by_householdId", (q) => q.eq("householdId", args.householdId!))
    .collect();

  const household = await ctx.db.get(args.householdId);
  const householdName = household?.name || "Household";
  const txType = args.type === TRANSACTION_TYPES.INCOME ? 'Income' : 'Expense';
  
  for (const member of members) {
    if (member.userId !== identity.subject) {
      await ctx.scheduler.runAfter(0, internal.push.sendNotification, {
        userId: member.userId,
        title: `New Transaction: ${householdName}`,
        body: `${txType}: ${args.amount} - ${args.description || 'No description'}`,
      });
    }
  }
}

// Replace with:
if (args.householdId) {
  // Skip notification if account is private and owned by someone else
  const account = await ctx.db.get(finalAccountId);
  const isPrivateAccount = account?.visibility === "private" && account?.userId === identity.subject;

  // Check if category has hideAmount
  let isHiddenCategory = false;
  if (finalCategoryId) {
    const category = await ctx.db.get(finalCategoryId);
    isHiddenCategory = category?.hideAmount === true;
  }

  // Skip notification altogether for private accounts or hidden categories
  if (!isPrivateAccount && !isHiddenCategory) {
    const members = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId", (q) => q.eq("householdId", args.householdId!))
      .collect();

    const household = await ctx.db.get(args.householdId);
    const householdName = household?.name || "Household";
    const txType = args.type === TRANSACTION_TYPES.INCOME ? 'Income' : 'Expense';
    
    for (const member of members) {
      if (member.userId !== identity.subject) {
        await ctx.scheduler.runAfter(0, internal.push.sendNotification, {
          userId: member.userId,
          title: `New Transaction: ${householdName}`,
          body: `${txType}: ${args.amount} - ${args.description || 'No description'}`,
        });
      }
    }
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: skip notifications for private accounts and hidden categories"
```

---

### Task 7: Backend Queries — Add hideAmount & Filter Private Accounts

**Files:**
- Modify: `convex/transactions.ts` — add hideAmount to response, filter private account transactions
- Modify: `components/transactions/types.ts` — add hideAmount to TransactionWithDetails

- [ ] **Step 1: Expand transaction response with hideAmount and filter private accounts**

In `convex/transactions.ts`, in the `get` query handler, after fetching `categories` (line 364-371), add a map of categoryId -> hideAmount:

```typescript
// After line 372 (const categoryMap = ...)
const categoryHideAmountMap = new Map<string, boolean>();
categories.filter(Boolean).forEach(c => {
  if (c) categoryHideAmountMap.set(String(c._id), c.hideAmount === true);
});
```

In the `pageWithDetails` map (around line 374), add `hideAmount` field and filter out transactions from private accounts:

First, need to get private account IDs owned by OTHER users. After fetching accounts:

```typescript
// After creating accountMap
const otherPrivateAccountIds = new Set<Id<"accounts">>();
accounts.filter(Boolean).forEach(a => {
  if (a && a.visibility === "private" && a.userId !== identity.subject) {
    otherPrivateAccountIds.add(a._id);
  }
});
```

Filter the pageResults before mapping:

```typescript
// After pageResults is defined (line 342), add:
const filteredPageResults = pageResults.filter(t => {
  if (otherPrivateAccountIds.has(t.accountId)) return false;
  if (t.toAccountId && otherPrivateAccountIds.has(t.toAccountId)) return false;
  return true;
});
```

Then use `filteredPageResults` instead of `pageResults` in the rest of the block.

In the transaction mapping, add hideAmount to each transaction:

```typescript
// In the return object (around line 392-398):
return {
  ...transaction,
  fromAccountName: fromAccount?.name,
  toAccountName: toAccount?.name,
  categoryName: category?.name,
  label: label || null,
  splits: splitsWithDetails,
  hideAmount: transaction.userId !== identity.subject
    ? (categoryHideAmountMap.get(String(transaction.categoryId)) ?? false)
    : false,
};
```

Also update the pagination return to use `filteredPageResults`:

```typescript
// Change:
const isDone = cursor + limit >= filteredResults.length;
const continueCursor = isDone ? "" : (cursor + limit).toString();
// To:
const isDone = cursor + limit >= filteredPageResults.length;
const continueCursor = isDone ? "" : (cursor + limit).toString();
```

- [ ] **Step 2: Update TransactionWithDetails type**

In `components/transactions/types.ts`, add `hideAmount` field:

```typescript
export type TransactionWithDetails = Omit<Doc<'transactions'>, 'splits' | 'accountId' | 'categoryId' | 'toAccountId' | 'labelId'> & {
  // ... existing fields
  hideAmount?: boolean;
};
```

- [ ] **Step 3: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/transactions.ts components/transactions/types.ts
git commit -m "feat: add hideAmount to transaction response and filter private account transactions"
```

---

### Task 8: Backend Dashboard — Filter Private Accounts

**Files:**
- Modify: `convex/dashboard.ts`

- [ ] **Step 1: Filter private accounts for non-owner**

In `convex/dashboard.ts`, in the `getDashboardSummary` handler, after fetching `allAccounts` (line 155/158) and before filtering by archived:

```typescript
// After allAccounts fetch:
const privateAccountIds = new Set<string>();
allAccounts.forEach(a => {
  if (a.visibility === "private") {
    if (a.userId !== userId) privateAccountIds.add(String(a._id));
  }
});

// Filter transactions to exclude those from private accounts
const filteredTransactions = allTransactions.filter(t => {
  if (privateAccountIds.has(String(t.accountId))) return false;
  if (t.toAccountId && privateAccountIds.has(String(t.toAccountId))) return false;
  return true;
});
```

Then replace all uses of `allTransactions` in calculations with `filteredTransactions`. The key places:
- Line 180: `const transfers = allTransactions.filter(...)` → use `filteredTransactions`
- Line 269: `const currentMonthTransactions = allTransactions.filter(...)` → use `filteredTransactions`
- Line 357: `allTransactions.forEach(...)` → use `filteredTransactions`
- Line 395: `const pendingReceivablesList = allTransactions.filter(...)` → use `filteredTransactions`
- Line 405: `const sortedTransactions = allTransactions.sort(...)` → use `filteredTransactions`

Also, for accounts displayed in the dashboard (liquidAccounts, savingsAccounts, etc.), filter out private accounts not owned by user:

In the `accounts` array (line 162), filter more strictly:

```typescript
// Change:
const accounts = allAccounts.filter(a => !a.isArchived);
// To:
const accounts = allAccounts.filter(a => {
  if (a.isArchived) return false;
  if (a.visibility === "private" && a.userId !== userId) return false;
  return true;
});
```

- [ ] **Step 2: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 2: Add hideAmount to dashboard recent transactions**

In `convex/dashboard.ts`, in the `recentTransactions` mapping (around line 443), add `hideAmount` to the return:

```typescript
// In the return object:
return {
  ...t,
  fromAccountName: fromAccount?.name,
  toAccountName: toAccount?.name,
  categoryName: category?.name,
  label,
  splits: splitsWithDetails,
  hideAmount: t.userId !== identity.subject
    ? (catMap.get(t.categoryId!)?.hideAmount === true ?? false)
    : false,
};
```

- [ ] **Step 3: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add convex/dashboard.ts
git commit -m "feat: filter private accounts and add hideAmount to dashboard"
```

---

### Task 9: Backend Category Details — Add hideAmount to Transaction History

**Files:**
- Modify: `convex/categories.ts`

- [ ] **Step 1: Add hideAmount to getCategoryDetails response**

In `convex/categories.ts`, in the `getCategoryDetails` handler, in the `recentTransactions` mapping (around line 306-346), add `hideAmount` to the return:

```typescript
// In the return object, after splits: splitsWithDetails:
hideAmount: t.userId !== identity.subject
  ? (category?.hideAmount ?? false)
  : false,
```

- [ ] **Step 2: Verify**

Run: `npx convex codegen`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add convex/categories.ts
git commit -m "feat: add hideAmount to category detail transaction history"
```

---

### Task 10: Frontend — getMemberRole Query

**Files:**
- Modify: `convex/households.ts` — add `getMemberRole` query

- [ ] **Step 1: Add getMemberRole query**

In `convex/households.ts`, add after `getPendingInvites`:

```typescript
export const getMemberRole = query({
  args: { householdId: v.id("households") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const member = await ctx.db
      .query("householdMembers")
      .withIndex("by_householdId_userId", q => q.eq("householdId", args.householdId).eq("userId", identity.subject))
      .first();

    return member?.role || null;
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/households.ts
git commit -m "feat: add getMemberRole query for frontend permission gating"
```

---

### Task 11: Frontend AccountDrawer — Visibility Dropdown

**Files:**
- Modify: `components/AccountDrawer.tsx`

- [ ] **Step 1: Add visibility field to schema**

```typescript
// In the AccountFormSchema, add after goalType:
visibility: z.enum(['shared', 'private']).optional(),
```

- [ ] **Step 2: Fetch user role for admin check**

```typescript
// Add import:
import { useUser } from '@clerk/nextjs';

// In the component, add after householdId:
const { user } = useUser();
const memberRole = useQuery(api.households.getMemberRole, 
  householdId ? { householdId } : "skip"
);
const isAdmin = memberRole === 'admin';
```

- [ ] **Step 3: Add default value and reset for visibility**

In the `defaultValues` object, add:
```typescript
visibility: 'shared',
```

In the `form.reset()` for edit mode (after `autoSaveDay`), add:
```typescript
visibility: (account as any).visibility || 'shared',
```

In the `form.reset()` for create mode, add to the reset:
```typescript
visibility: 'shared',
```

- [ ] **Step 4: Add visibility dropdown UI**

After the goal settings section (after all `{accountType === 'SAVING' || accountType === 'ASSET'}` block around line 649), add before the hidden submit button:

```tsx
{/* Visibility Setting — only for admins in household context */}
{isAdmin && householdId && (
  <div className="border rounded-md p-3 bg-muted/20">
    <FormField
      control={form.control}
      name="visibility"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Account Visibility</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value || 'shared'}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="shared">Shared — visible to all members</SelectItem>
              <SelectItem value="private">Private — only you can see this</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground italic mt-1">
            {field.value === 'private'
              ? 'This account and its transactions will be hidden from other household members.'
              : 'All household members can see this account and its balance.'}
          </p>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
)}
```

- [ ] **Step 5: Pass visibility to create/update mutations**

In the onSubmit, add `visibility` to the payload:

```typescript
const payload = {
  name: data.name,
  balance: data.balance,
  type: data.type,
  initialQuantity: data.initialQuantity,
  unit: data.unit,
  targetAmount: data.enableGoal ? data.targetAmount : undefined,
  targetDate: targetDateStr,
  goalType: data.enableGoal ? data.goalType : undefined,
  monthlyBudget: data.monthlyBudget ? data.monthlyBudget.replace(/,/g, '') : undefined,
  visibility: data.visibility || 'shared',
};
```

- [ ] **Step 6: Commit**

```bash
git add components/AccountDrawer.tsx
git commit -m "feat: add visibility dropdown to AccountDrawer for admins"
```

---

### Task 12: Frontend CategoryDrawer — hideAmount Checkbox

**Files:**
- Modify: `components/CategoryDrawer.tsx`

- [ ] **Step 1: Add hideAmount to form schema**

```typescript
// In the CategoryFormSchema, add after goalType:
hideAmount: z.boolean().optional(),
```

- [ ] **Step 2: Fetch user role**

```typescript
// Add import:
import { useUser } from '@clerk/nextjs';

// In the component, after householdId:
const { user } = useUser();
const memberRole = useQuery(api.households.getMemberRole,
  householdId ? { householdId } : "skip"
);
const isAdmin = memberRole === 'admin';
```

- [ ] **Step 3: Add default value and reset**

In `defaultValues`, add:
```typescript
hideAmount: false,
```

In `form.reset()` for edit mode, add:
```typescript
hideAmount: (category as any).hideAmount || false,
```

In create mode reset:
```typescript
hideAmount: false,
```

- [ ] **Step 4: Add hideAmount checkbox UI**

After the `enablePacing` Switch (around line 351), add:

```tsx
{/* Hide Amount from Members — only for admins in household context */}
{isAdmin && householdId && (
  <FormField
    control={form.control}
    name="hideAmount"
    render={({ field }) => (
      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <FormLabel className="text-base">
            Hide Amount from Members
          </FormLabel>
          <div className="text-sm text-muted-foreground">
            Transactions in this category will show but their nominal will be hidden from other members.
          </div>
        </div>
        <FormControl>
          <Switch
            checked={field.value || false}
            onCheckedChange={field.onChange}
          />
        </FormControl>
      </FormItem>
    )}
  />
)}
```

- [ ] **Step 5: Pass hideAmount to update mutation**

In the `onSubmit`, add to `payload`:
```typescript
hideAmount: data.hideAmount || false,
```

- [ ] **Step 6: Commit**

```bash
git add components/CategoryDrawer.tsx
git commit -m "feat: add hideAmount toggle to CategoryDrawer for admins"
```

---

### Task 13: Frontend TransactionItem — Mask hideAmount

**Files:**
- Modify: `components/TransactionItem.tsx`

- [ ] **Step 1: Mask display amount when hideAmount is true**

In `components/TransactionItem.tsx`, in the display amount section, replace the direct format with a mask check:

For the main amount display (around line 96-108), change:

```tsx
<p
  className={cn(
    'font-bold text-sm',
    transaction.type === 'expense'
      ? 'text-destructive'
      : transaction.type === 'income' ? 'text-success' : 'text-primary'
  )}
>
  {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '' }
  {displayAmount}
</p>
```

To:

```tsx
<p
  className={cn(
    'font-bold text-sm',
    transaction.type === 'expense'
      ? 'text-destructive'
      : transaction.type === 'income' ? 'text-success' : 'text-primary'
  )}
>
  {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : '' }
  {transaction.hideAmount ? '••••' : displayAmount}
</p>
```

- [ ] **Step 2: Commit**

```bash
git add components/TransactionItem.tsx
git commit -m "feat: mask transaction amount when hideAmount is true"
```

---

### Task 14: Frontend Pages — Permission Gating for Members

**Files:**
- Modify: `app/accounts/page.tsx`
- Modify: `app/categories/page.tsx`
- Modify: `app/labels/page.tsx`

- [ ] **Step 1: Hide create button on Accounts page**

In `app/accounts/page.tsx`, add:

```typescript
// Add import:
import { useUser } from '@clerk/nextjs';

// In component, add after householdId:
const { user } = useUser();
const memberRole = useQuery(api.households.getMemberRole,
  householdId ? { householdId } : "skip"
);
const isAdmin = memberRole === 'admin';
```

Replace the PageHeader's action button (line 207):

```tsx
<PageHeader 
  title="Accounts" 
  description="Manage your liquid cash, savings, and assets."
  action={isAdmin ? <Button onClick={handleCreate}>Create Account</Button> : undefined}
/>
```

- [ ] **Step 2: Hide create button on Categories page**

In `app/categories/page.tsx`, same pattern:

```typescript
// Add imports:
import { useUser } from '@clerk/nextjs';

// After householdId:
const { user } = useUser();
const memberRole = useQuery(api.households.getMemberRole,
  householdId ? { householdId } : "skip"
);
const isAdmin = memberRole === 'admin';
```

Replace the Create Category button (line 222):

```tsx
{isAdmin && <Button onClick={handleCreate}>Create Category</Button>}
```

- [ ] **Step 3: Hide create button on Labels page**

In `app/labels/page.tsx`, same pattern:

```typescript
// Add imports:
import { useUser } from '@clerk/nextjs';

// After householdId:
const { user } = useUser();
const memberRole = useQuery(api.households.getMemberRole,
  householdId ? { householdId } : "skip"
);
const isAdmin = memberRole === 'admin';
```

Replace the Create Label button (line 62):

```tsx
{isAdmin && <Button onClick={handleCreate}>Create Label</Button>}
```

- [ ] **Step 4: Verify build**

```bash
npx next build --webpack
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add app/accounts/page.tsx app/categories/page.tsx app/labels/page.tsx
git commit -m "feat: hide create buttons for member role on accounts, categories, labels pages"
```

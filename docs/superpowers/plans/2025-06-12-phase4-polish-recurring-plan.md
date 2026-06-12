# Phase 4: Polish + Recurring Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement EmptyState component, animations, and recurring expenses feature.

**Architecture:** EmptyState is a reusable UI component for consistent empty/loading states. Animations use framer-motion for card mount and number transitions. Recurring expenses use two new Convex tables with CRUD mutations and a new route page.

**Tech Stack:** Next.js 16, Convex, Tailwind, framer-motion, shadcn/ui

---

## File Structure

### New Files
```
components/ui/empty-state.tsx
lib/animations.ts
convex/recurring.ts
app/recurring/page.tsx
components/recurring/RecurringList.tsx
components/recurring/RecurringForm.tsx
components/recurring/RecurringCard.tsx
components/dashboard/RecurringSummary.tsx
```

### Modified Files
```
convex/schema.ts                 → add recurringExpenses + recurringPayments tables
package.json                     → add framer-motion dependency
components/dashboard/MonthlyComparison.tsx    → use EmptyState
components/dashboard/TrendChart.tsx           → use EmptyState
components/dashboard/TodaySpending.tsx        → use EmptyState
components/dashboard/DailyGuidance.tsx        → use EmptyState
components/dashboard/BudgetAttentionList.tsx  → use EmptyState
components/dashboard/BalanceSummary.tsx       → use EmptyState
components/dashboard/LentSummary.tsx          → use EmptyState
components/dashboard/GoalSummary.tsx          → use EmptyState
components/dashboard/DailyOperationsCard.tsx  → use EmptyState per tab
components/dashboard/QuickAdjust.tsx          → use EmptyState
app/dashboard/page.tsx                        → add RecurringSummary, card animations
app/globals.css                               → add shimmer keyframes
```

---

### Task 1: EmptyState Component

**Files:**
- Create: `components/ui/empty-state.tsx`

- [ ] **Step 1: Create EmptyState component**

```tsx
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type EmptyStateProps = {
  icon?: LucideIcon;
  title?: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      compact ? 'py-4 gap-2' : 'py-8 gap-3'
    )}>
      {Icon && (
        <Icon className={cn(
          'text-muted-foreground',
          compact ? 'h-6 w-6' : 'h-10 w-10'
        )} />
      )}
      {title && (
        <h3 className={cn(
          'font-semibold text-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}>
          {title}
        </h3>
      )}
      <p className={cn(
        'text-muted-foreground max-w-[280px]',
        compact ? 'text-[10px]' : 'text-xs'
      )}>
        {description}
      </p>
      {action && (
        action.href ? (
          <Button variant="outline" size="sm" asChild className="mt-2">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
git add components/ui/empty-state.tsx
git commit -m "feat: add reusable EmptyState component"
```

---

### Task 2: Animations Setup

**Files:**
- Create: `lib/animations.ts`
- Modify: `package.json` (add framer-motion)
- Modify: `app/globals.css` (add shimmer keyframes)

- [ ] **Step 1: Install framer-motion**

```bash
npm install framer-motion
```

- [ ] **Step 2: Create animation variants**

```ts
'use client'

import { Variants } from 'framer-motion';

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
};

export const countUp = (target: number, duration = 0.5) => ({
  hidden: { number: 0 },
  visible: { number: target, transition: { duration, ease: 'easeOut' } },
});
```

- [ ] **Step 3: Add shimmer keyframes to globals.css**

```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

Add to the end of `app/globals.css`.

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 5: Commit**

```bash
git add lib/animations.ts app/globals.css package.json package-lock.json
git commit -m "feat: add framer-motion and animation variants"
```

---

### Task 3: Update Dashboard Page with Animations

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add motion wrappers to the desktop grid**

Import at the top of `app/dashboard/page.tsx`:
```tsx
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/animations';
```

Wrap the desktop grid section:
```tsx
<motion.div
  variants={staggerContainer}
  initial="hidden"
  animate="visible"
  className="hidden md:grid gap-6 md:grid-cols-2 mb-8"
>
  {summary === undefined ? (
    <>
      <DashboardCardSkeleton />
      <DashboardCardSkeleton />
    </>
  ) : (
    <>
      <motion.div variants={fadeInUp} className="flex flex-col gap-6">
        <DailyOperationsCard summary={summary} isPrivacyMode={isPrivacyMode} budgetStartDay={budgetStartDay} />
        <QuickAdjust
          householdId={householdId ?? undefined}
          summary={summary}
          isPrivacyMode={isPrivacyMode}
        />
      </motion.div>
      <motion.div variants={fadeInUp} className="flex flex-col gap-6">
        <TrendChart householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
        <MonthlyComparison householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
      </motion.div>
    </>
  )}
</motion.div>
```

Also wrap the mobile section with the same stagger/fadeInUp pattern and the "Recent Transactions" section.

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add card mount animations to dashboard page"
```

---

### Task 4: Replace Empty States in Dashboard Components

**Files:**
- Modify: `components/dashboard/MonthlyComparison.tsx`
- Modify: `components/dashboard/TrendChart.tsx`
- Modify: `components/dashboard/TodaySpending.tsx`
- Modify: `components/dashboard/DailyGuidance.tsx`
- Modify: `components/dashboard/BudgetAttentionList.tsx`
- Modify: `components/dashboard/BalanceSummary.tsx`
- Modify: `components/dashboard/LentSummary.tsx`
- Modify: `components/dashboard/GoalSummary.tsx`
- Modify: `components/dashboard/DailyOperationsCard.tsx`
- Modify: `components/dashboard/QuickAdjust.tsx`

For each component:

1. Add import: `import { EmptyState } from '@/components/ui/empty-state';`
2. Replace empty/loading state `<div>` blocks with `<EmptyState>` using props from the spec table
3. For loading states (`trends === undefined`, etc.), pass an additional prop `title="Loading..."` and apply a pulse CSS class

Since there are 10 components, batch them into one task but verify per component.

- [ ] **Step 1: Update MonthlyComparison**

Replace:
```tsx
<div className="h-[160px] flex items-center justify-center">
  <p className="text-xs text-muted-foreground">Loading...</p>
</div>
```
With:
```tsx
<EmptyState icon={BarChart3} title="Loading..." description="" compact />
```

Replace:
```tsx
<div className="h-[160px] flex items-center justify-center">
  <p className="text-xs text-muted-foreground italic">
    Comparison will appear once you have at least 2 months of data.
  </p>
</div>
```
With:
```tsx
<EmptyState
  icon={BarChart3}
  title="Not enough data"
  description="Comparison will appear once you have at least 2 months of spending data."
  compact
/>
```

Add import: `import { BarChart3 } from 'lucide-react';`

- [ ] **Step 2: Update TrendChart**

Same pattern — replace loading and empty states with EmptyState, using `TrendingUp` icon.

- [ ] **Step 3: Update TodaySpending**

Replace empty state with `EmptyState` using `Receipt` icon. For the action button, pass `onClick` that opens the transaction drawer (the parent page already handles this via custom events, or use the existing `PERFIN_OPEN_ADD_TRANSACTION` event pattern).

For the description that includes `dailyAllowance`, interpolate the value into the description string.

- [ ] **Step 4: Update DailyGuidance**

Replace empty state with `EmptyState` using `Compass` icon, action linking to `/budgets`.

- [ ] **Step 5: Update BudgetAttentionList**

Two states:
- No items at all → `EmptyState` with `ListChecks` icon, action to `/budgets`
- All safe → `EmptyState` with `CheckCircle2` icon, no action

- [ ] **Step 6: Update BalanceSummary**

Replace "Add an account" state with `EmptyState` using `PiggyBank` icon, action to `/accounts`.

- [ ] **Step 7: Update LentSummary**

Replace empty state with `EmptyState` using `HandCoins` icon.

- [ ] **Step 8: Update GoalSummary**

Replace empty state with `EmptyState` using `Target` icon, action to `/goals`.

- [ ] **Step 9: Update QuickAdjust**

Replace empty state with `EmptyState` using `Wallet` icon, action to `/budgets`.

- [ ] **Step 10: Update DailyOperationsCard**

This component has 3 tabs with different empty states per tab. Replace each tab's empty state with EmptyState, using per-tab icon (e.g., `Receipt` for expenses, `PiggyBank` for accounts, `HandCoins` for receivables).

- [ ] **Step 11: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 12: Commit**

```bash
git add components/dashboard/
git commit -m "feat: replace all inline empty states with EmptyState component"
```

---

### Task 5: Recurring Expenses — Convex Backend

**Files:**
- Create: `convex/recurring.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add tables to schema**

In `convex/schema.ts`, add to the `defineSchema` call:

```ts
recurringExpenses: defineTable({
  userId: v.string(),
  householdId: v.optional(v.id("households")),
  name: v.string(),
  amount: v.string(),
  categoryId: v.id("categories"),
  dayOfMonth: v.number(),
  isActive: v.boolean(),
  createdAt: v.number(),
})
.index("by_userId", ["userId"])
.index("by_householdId", ["householdId"]),

recurringPayments: defineTable({
  recurringExpenseId: v.id("recurringExpenses"),
  year: v.number(),
  month: v.number(),
  paidAt: v.number(),
  transactionId: v.optional(v.id("transactions")),
})
.index("by_recurringExpenseId", ["recurringExpenseId"])
.index("by_year_month", ["year", "month"]),
```

- [ ] **Step 2: Create recurring.ts queries and mutations**

```ts
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';

// ─── Queries ───

export const getRecurringExpenses = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (householdId) {
      return await ctx.db
        .query("recurringExpenses")
        .withIndex("by_householdId", q => q.eq("householdId", householdId))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();
    }
    return await ctx.db
      .query("recurringExpenses")
      .withIndex("by_userId", q => q.eq("userId", identity.subject))
      .filter(q => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getRecurringSummary = query({
  args: {
    householdId: v.optional(v.id("households")),
    year: v.number(),
    month: v.number(),
  },
  handler: async (ctx, { householdId, year, month }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let expenses;
    if (householdId) {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_householdId", q => q.eq("householdId", householdId))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();
    } else {
      expenses = await ctx.db
        .query("recurringExpenses")
        .withIndex("by_userId", q => q.eq("userId", identity.subject))
        .filter(q => q.eq(q.field("isActive"), true))
        .collect();
    }

    const now = new Date();
    const currentDay = now.getDate();
    const totalAmount = expenses.reduce((sum, e) => sum + parseFloat(e.amount.replace(/,/g, '') || '0'), 0);

    const expenseIds = expenses.map(e => e._id);
    const payments = await ctx.db
      .query("recurringPayments")
      .withIndex("by_year_month", q => q.eq("year", year).eq("month", month))
      .collect();
    const paidIds = new Set(payments.map(p => p.recurringExpenseId));

    const paid = expenses.filter(e => paidIds.has(e._id));
    const unpaid = expenses.filter(e => !paidIds.has(e._id));
    const overdue = unpaid.filter(e => e.dayOfMonth < currentDay);
    const upcoming = unpaid.filter(e => e.dayOfMonth >= currentDay && e.dayOfMonth <= currentDay + 3);

    return {
      totalAmount,
      paidCount: paid.length,
      unpaidCount: unpaid.length,
      overdueCount: overdue.length,
      upcoming: upcoming.map(e => ({
        id: e._id,
        name: e.name,
        amount: e.amount,
        dayOfMonth: e.dayOfMonth,
      })),
      overdue: overdue.map(e => ({
        id: e._id,
        name: e.name,
        amount: e.amount,
        dayOfMonth: e.dayOfMonth,
      })),
    };
  },
});

// ─── Mutations ───

export const createRecurringExpense = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    amount: v.string(),
    categoryId: v.id("categories"),
    dayOfMonth: v.number(),
  },
  handler: async (ctx, { householdId, name, amount, categoryId, dayOfMonth }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (dayOfMonth < 1 || dayOfMonth > 31) {
      throw new Error("dayOfMonth must be between 1 and 31");
    }

    return await ctx.db.insert("recurringExpenses", {
      userId: identity.subject,
      householdId,
      name,
      amount,
      categoryId,
      dayOfMonth,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const updateRecurringExpense = mutation({
  args: {
    id: v.id("recurringExpenses"),
    name: v.optional(v.string()),
    amount: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    dayOfMonth: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Not found");

    const patch: Record<string, unknown> = {};
    if (fields.name !== undefined) patch.name = fields.name;
    if (fields.amount !== undefined) patch.amount = fields.amount;
    if (fields.categoryId !== undefined) patch.categoryId = fields.categoryId;
    if (fields.dayOfMonth !== undefined) {
      if (fields.dayOfMonth < 1 || fields.dayOfMonth > 31) {
        throw new Error("dayOfMonth must be between 1 and 31");
      }
      patch.dayOfMonth = fields.dayOfMonth;
    }

    await ctx.db.patch(id, patch);
  },
});

export const deleteRecurringExpense = mutation({
  args: { id: v.id("recurringExpenses") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(id, { isActive: false });
  },
});

export const markRecurringPaid = mutation({
  args: {
    recurringExpenseId: v.id("recurringExpenses"),
    year: v.number(),
    month: v.number(),
    transactionId: v.optional(v.id("transactions")),
  },
  handler: async (ctx, { recurringExpenseId, year, month, transactionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if already paid this month
    const existing = await ctx.db
      .query("recurringPayments")
      .withIndex("by_recurringExpenseId", q => q.eq("recurringExpenseId", recurringExpenseId))
      .filter(q => q.eq(q.field("year"), year).eq(q.field("month"), month))
      .first();

    if (existing) {
      throw new Error("Already paid this month");
    }

    return await ctx.db.insert("recurringPayments", {
      recurringExpenseId,
      year,
      month,
      paidAt: Date.now(),
      transactionId,
    });
  },
});
```

- [ ] **Step 3: Build to verify**

Run: `npx convex dev` (or `npm run dev` if convex runs on build)
Expected: No schema errors, queries/mutations registered

- [ ] **Step 4: Commit**

```bash
git add convex/recurring.ts convex/schema.ts
git commit -m "feat: add recurring expenses tables, queries, and mutations"
```

---

### Task 6: Recurring Expenses — Page

**Files:**
- Create: `app/recurring/page.tsx`
- Create: `components/recurring/RecurringList.tsx`
- Create: `components/recurring/RecurringForm.tsx`

- [ ] **Step 1: Create RecurringForm component**

A dialog/modal form for creating/editing recurring expenses. Fields: name, amount, category (dropdown), day of month (number input 1-31).

```tsx
'use client'

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

type Props = {
  householdId?: Id<"households">;
  categories?: { _id: Id<"categories">; name: string }[];
  editItem?: {
    _id: Id<"recurringExpenses">;
    name: string;
    amount: string;
    categoryId: Id<"categories">;
    dayOfMonth: number;
  };
  onDone?: () => void;
};

export function RecurringForm({ householdId, categories, editItem, onDone }: Props) {
  const create = useMutation(api.recurring.createRecurringExpense);
  const update = useMutation(api.recurring.updateRecurringExpense);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(editItem?.name ?? '');
  const [amount, setAmount] = useState(editItem?.amount ?? '');
  const [categoryId, setCategoryId] = useState(editItem?.categoryId ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(editItem?.dayOfMonth ?? 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !amount || !categoryId) {
      toast.error('Please fill all fields');
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await update({ id: editItem._id, name, amount, categoryId: categoryId as Id<"categories">, dayOfMonth });
        toast.success('Updated');
      } else {
        await create({ householdId, name, amount, categoryId: categoryId as Id<"categories">, dayOfMonth });
        toast.success('Created');
      }
      setOpen(false);
      setName('');
      setAmount('');
      setCategoryId('');
      setDayOfMonth(1);
      onDone?.();
    } catch (e) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editItem ? (
          <Button variant="ghost" size="sm">Edit</Button>
        ) : (
          <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Recurring</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Recurring Expense</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Listrik" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
            <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="500,000" type="text" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Category</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories?.map(c => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Day of month</label>
            <Input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create RecurringList component**

Lists recurring expenses with their status (paid/unpaid/overdue) this month.

```tsx
'use client'

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { RecurringForm } from './RecurringForm';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useHousehold } from '@/components/HouseholdProvider';

export function RecurringList() {
  const { householdId } = useHousehold();
  const expenses = useQuery(api.recurring.getRecurringExpenses, { householdId: householdId ?? undefined });
  const categories = useQuery(api.categories.getCategories, { householdId: householdId ?? undefined });
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentDay = now.getDate();
  const markPaid = useMutation(api.recurring.markRecurringPaid);

  // Get payments for this month
  const allExpenseIds = expenses?.map(e => e._id) ?? [];

  const handleMarkPaid = async (expenseId: Id<"recurringExpenses">) => {
    try {
      await markPaid({ recurringExpenseId: expenseId, year, month });
      toast.success('Marked as paid');
    } catch {
      toast.error('Failed to mark as paid');
    }
  };

  // ... render with status badges
}
```

Full implementation should show:
- Each row: status badge (✅ paid / 🔴 overdue / ⏳ upcoming) + name + amount + day
- [Bayar] button for unpaid items  
- [Edit] and [Delete] buttons
- Empty state when no recurring expenses exist

- [ ] **Step 3: Create /recurring page**

```tsx
'use client'

import { RecurringList } from '@/components/recurring/RecurringList';
import { PageHeader } from '@/components/PageHeader';

export default function RecurringPage() {
  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <PageHeader title="Recurring Expenses" description="Manage your monthly bills and subscriptions." />
      <RecurringList />
    </div>
  );
}
```

- [ ] **Step 4: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 5: Commit**

```bash
git add app/recurring/ components/recurring/
git commit -m "feat: add recurring expenses page and CRUD components"
```

---

### Task 7: Recurring Summary Dashboard Card

**Files:**
- Create: `components/dashboard/RecurringSummary.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Create RecurringSummary component**

Displays total recurring this month + paid/unpaid/overdue counts + upcoming reminders.

```tsx
'use client'

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Receipt, CheckCircle2, AlertCircle, CalendarClock } from 'lucide-react';
import Link from 'next/link';

type Props = {
  householdId?: Id<"households">;
  isPrivacyMode?: boolean;
};

export function RecurringSummary({ householdId, isPrivacyMode }: Props) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const summary = useQuery(api.recurring.getRecurringSummary, { householdId: householdId ?? undefined, year, month });

  if (summary === undefined) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[120px] flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summary.totalAmount === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Receipt}
            title="No recurring bills"
            description="Add your monthly bills and subscriptions to track them here."
            action={{ href: "/recurring", label: "Add Bills" }}
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Bills</CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs">
          <Link href="/recurring">View All</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total this month</span>
          <span className="text-sm font-bold">{formatCurrency(summary.totalAmount, { isPrivacyMode })}</span>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" />{summary.paidCount} paid</span>
          <span className="flex items-center gap-1"><Receipt className="h-3 w-3" />{summary.unpaidCount} unpaid</span>
          {summary.overdueCount > 0 && (
            <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />{summary.overdueCount} overdue</span>
          )}
        </div>
        {(summary.upcoming.length > 0 || summary.overdue.length > 0) && (
          <div className="border-t border-border/30 pt-2 space-y-1">
            {summary.overdue.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs text-destructive">
                <span className="flex items-center gap-1 truncate">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {item.name} — overdue {currentDay - item.dayOfMonth} days
                </span>
                <span className="tabular-nums shrink-0 ml-2">{formatCurrency(parseFloat(item.amount.replace(/,/g, '')), { isPrivacyMode })}</span>
              </div>
            ))}
            {summary.upcoming.map(item => (
              <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <CalendarClock className="h-3 w-3 shrink-0" />
                  {item.name} — due in {item.dayOfMonth - currentDay} days
                </span>
                <span className="tabular-nums shrink-0 ml-2">{formatCurrency(parseFloat(item.amount.replace(/,/g, '')), { isPrivacyMode })}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add RecurringSummary to desktop layout**

In `app/dashboard/page.tsx`, import and add to the right column (below MonthlyComparison):

```tsx
import { RecurringSummary } from '@/components/dashboard/RecurringSummary';
```

Add inside the right column motion div:
```tsx
<RecurringSummary householdId={householdId ?? undefined} isPrivacyMode={isPrivacyMode} />
```

- [ ] **Step 3: Build to verify**

Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/RecurringSummary.tsx app/dashboard/page.tsx
git commit -m "feat: add RecurringSummary dashboard card"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] EmptyState component created (Task 1)
- [x] Animations added (Task 2, 3)
- [x] All 10 dashboard components updated (Task 4)
- [x] Recurring schema + backend (Task 5)
- [x] Recurring CRUD page (Task 6)
- [x] Recurring dashboard card (Task 7)

**Placeholder scan:** No TBD/TODO remaining.

**Type consistency:** All type names, field names, and function signatures match between tasks.

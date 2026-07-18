# Label Redesign: Multi-Label + Icon System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-label system with multi-label support and swap color-based visuals for Lucide icons.

**Architecture:** Schema changes propagate from Convex backend (labels table, transaction fields) through all query/mutation functions, then to frontend components (form, display, filters). Migration function converts existing data.

**Tech Stack:** Convex (schema + mutations/queries), React 19, lucide-react, react-hook-form, zod, Tailwind CSS v4, shadcn/ui

---

## File Map

| File | Change |
|------|--------|
| `convex/schema.ts` | `color` → `icon`, `labelId` → `labelIds` (array) |
| `convex/labels.ts` | Replace `color` arg with `icon` |
| `convex/lib/transactions.ts` | Update `generateSearchTags` for array fields |
| `convex/transactions.ts` | Update `create`/`update` args + all 5 query functions |
| `convex/categories.ts` | Update label resolution (lines ~300-350) |
| `convex/dashboard.ts` | Update label resolution (lines ~440-480) |
| `convex/migrations.ts` | Add `migrateLabelsToIconAndMultiLabel` function |
| `components/transactions/types.ts` | Update `TransactionWithDetails` type |
| `components/LabelDrawer.tsx` | Replace color picker with icon picker grid |
| `app/labels/page.tsx` | Compact icon-based label list |
| `components/TransactionDrawer.tsx` | Multi-select labels, update form schema |
| `components/SplitEditorDrawer.tsx` | Multi-select labels per split |
| `components/TransactionItem.tsx` | Multi-label badge with icons |
| `components/TransactionFilters.tsx` | Update badge display for labels |
| `components/skeletons.tsx` | Update `LabelsListSkeleton` |

---

## Task 1: Migration Function

**Files:**
- Modify: `convex/migrations.ts`

- [ ] **Step 1: Add migration function**

Append to `convex/migrations.ts`:

```typescript
/**
 * Migration: Labels color→icon + single→multi-label
 *
 * 1. Labels: remove `color`, add `icon: "Tag"` (default)
 * 2. Transactions: labelId → labelIds (array)
 * 3. Splits: labelId → labelIds (array)
 * 4. Recompute searchLabelIds
 *
 * Run ONCE from Convex Dashboard after deploying new schema.
 */
export const migrateLabelsToIconAndMultiLabel = mutation({
  args: {},
  handler: async (ctx) => {
    // --- Migrate Labels: color → icon ---
    const labels = await ctx.db.query("labels").collect();
    let labelsUpdated = 0;
    for (const label of labels) {
      const patch: Record<string, unknown> = {};
      if ("color" in label) {
        patch.icon = "Tag";
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(label._id, patch);
        labelsUpdated++;
      }
    }

    // --- Migrate Transactions: labelId → labelIds ---
    const transactions = await ctx.db.query("transactions").collect();
    let txUpdated = 0;

    for (const tx of transactions) {
      const patch: Record<string, unknown> = {};

      // Root labelId → labelIds
      if (tx.labelId) {
        patch.labelIds = [tx.labelId];
      }

      // Splits labelId → labelIds
      if (tx.splits && tx.splits.length > 0) {
        patch.splits = tx.splits.map((s) => ({
          ...s,
          labelIds: s.labelId ? [s.labelId] : [],
        }));
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(tx._id, patch);
        txUpdated++;
      }
    }

    // --- Recompute searchLabelIds for all transactions ---
    const allTx = await ctx.db.query("transactions").collect();
    let searchUpdated = 0;

    for (const tx of allTx) {
      const labelIdsSet = new Set<string>();

      if (tx.labelIds && Array.isArray(tx.labelIds)) {
        tx.labelIds.forEach((id) => labelIdsSet.add(String(id)));
      }

      if (tx.splits && tx.splits.length > 0) {
        for (const split of tx.splits) {
          if (split.labelIds && Array.isArray(split.labelIds)) {
            split.labelIds.forEach((id) => labelIdsSet.add(String(id)));
          }
        }
      }

      const newSearchLabelIds = Array.from(labelIdsSet);
      const currentSearch = tx.searchLabelIds || [];

      if (
        JSON.stringify(newSearchLabelIds.sort()) !==
        JSON.stringify(currentSearch.sort())
      ) {
        await ctx.db.patch(tx._id, { searchLabelIds: newSearchLabelIds });
        searchUpdated++;
      }
    }

    return {
      labelsUpdated,
      transactionsUpdated: txUpdated,
      searchLabelIdsRecomputed: searchUpdated,
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/migrations.ts
git commit -m "feat: add label redesign migration function"
```

---

## Task 2: Schema Update

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Update labels table — replace `color` with `icon`**

In `convex/schema.ts`, find the `labels` table definition (line 151) and replace:

```typescript
// BEFORE (lines 151-158):
labels: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    color: v.string(),
})
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),

// AFTER:
labels: defineTable({
    userId: v.string(),
    householdId: v.optional(v.id("households")),
    name: v.string(),
    icon: v.string(),
})
    .index("by_userId", ["userId"])
    .index("by_householdId", ["householdId"]),
```

- [ ] **Step 2: Update transactions table — `labelId` → `labelIds`**

In `convex/schema.ts`, find the `transactions` table:

```typescript
// BEFORE (line 58):
    labelId: v.optional(v.id("labels")),

// AFTER:
    labelIds: v.optional(v.array(v.id("labels"))),
```

- [ ] **Step 3: Update splits schema — `labelId` → `labelIds`**

In `convex/schema.ts`, find the splits definition (line 56):

```typescript
// BEFORE (line 56):
      labelId: v.optional(v.id("labels")),

// AFTER:
      labelIds: v.optional(v.array(v.id("labels"))),
```

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: schema — color→icon on labels, labelId→labelIds on transactions"
```

---

## Task 3: Backend — Labels CRUD

**Files:**
- Modify: `convex/labels.ts`

- [ ] **Step 1: Update `create` mutation — replace `color` with `icon`**

In `convex/labels.ts`, find the `create` mutation args (line 20):

```typescript
// BEFORE (lines 20-25):
export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    color: v.string(),
  },

// AFTER:
export const create = mutation({
  args: {
    householdId: v.optional(v.id("households")),
    name: v.string(),
    icon: v.string(),
  },
```

- [ ] **Step 2: Update `update` mutation — replace `color` with `icon`**

In `convex/labels.ts`, find the `update` mutation args (line 43):

```typescript
// BEFORE (lines 43-48):
export const update = mutation({
  args: {
    id: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },

// AFTER:
export const update = mutation({
  args: {
    id: v.id("labels"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
```

- [ ] **Step 3: Commit**

```bash
git add convex/labels.ts
git commit -m "feat: labels CRUD — icon replaces color"
```

---

## Task 4: Backend — generateSearchTags

**Files:**
- Modify: `convex/lib/transactions.ts`

- [ ] **Step 1: Update function signature and logic**

Replace the entire file `convex/lib/transactions.ts`:

```typescript
/**
 * Helper logic for transaction indexing and search.
 */

/**
 * Generates flat arrays of category and label IDs for indexing purposes.
 * This includes IDs from both the root transaction and all splits.
 * Supports both legacy single labelId and new labelIds array.
 */
export function generateSearchTags(data: {
  categoryId?: string;
  labelId?: string;
  labelIds?: string[];
  isSplit?: boolean;
  splits?: Array<{
    categoryId: string;
    labelId?: string;
    labelIds?: string[];
  }>;
}) {
  const categoryIds = new Set<string>();
  const labelIdsSet = new Set<string>();

  // 1. Extract from root
  if (data.categoryId) categoryIds.add(String(data.categoryId));
  if (data.labelIds && Array.isArray(data.labelIds)) {
    data.labelIds.forEach((id) => labelIdsSet.add(String(id)));
  } else if (data.labelId) {
    labelIdsSet.add(String(data.labelId));
  }

  // 2. Extract from splits
  if (data.isSplit && data.splits) {
    data.splits.forEach((split) => {
      if (split.categoryId) categoryIds.add(String(split.categoryId));
      if (split.labelIds && Array.isArray(split.labelIds)) {
        split.labelIds.forEach((id) => labelIdsSet.add(String(id)));
      } else if (split.labelId) {
        labelIdsSet.add(String(split.labelId));
      }
    });
  }

  return {
    searchCategoryIds: Array.from(categoryIds),
    searchLabelIds: Array.from(labelIdsSet),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add convex/lib/transactions.ts
git commit -m "feat: generateSearchTags supports labelIds array"
```

---

## Task 5: Backend — Transactions Create Mutation

**Files:**
- Modify: `convex/transactions.ts` (lines 837-869, 1062-1074)

- [ ] **Step 1: Update `create` mutation args**

In `convex/transactions.ts`, find the `create` mutation args (line 837). Replace:

```typescript
// BEFORE (lines 848-854):
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelId: v.optional(v.id("labels")),
    }))),
    labelId: v.optional(v.id("labels")),

// AFTER:
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelIds: v.optional(v.array(v.id("labels"))),
    }))),
    labelIds: v.optional(v.array(v.id("labels"))),
```

- [ ] **Step 2: Update `create` handler — pass `labelIds` to generateSearchTags**

In `convex/transactions.ts`, find the `generateSearchTags` call inside `create` (line 1062):

```typescript
// BEFORE (lines 1062-1065):
    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...insertArgs,
        categoryId: finalCategoryId as string | undefined,
    });

// AFTER:
    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...insertArgs,
        categoryId: finalCategoryId as string | undefined,
        labelIds: args.labelIds?.map(String),
        splits: args.splits?.map(s => ({
          ...s,
          labelIds: s.labelIds?.map(String),
        })),
    });
```

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: transactions.create — labelIds array support"
```

---

## Task 6: Backend — Transactions Update Mutation

**Files:**
- Modify: `convex/transactions.ts` (lines 1154-1185, 1438-1441)

- [ ] **Step 1: Update `update` mutation args**

In `convex/transactions.ts`, find the `update` mutation args (line 1154). Replace:

```typescript
// BEFORE (lines 1165-1171):
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelId: v.optional(v.id("labels")),
    }))),
    labelId: v.optional(v.id("labels")),

// AFTER:
    splits: v.optional(v.array(v.object({
      categoryId: v.id("categories"),
      amount: v.string(),
      description: v.optional(v.string()),
      labelIds: v.optional(v.array(v.id("labels"))),
    }))),
    labelIds: v.optional(v.array(v.id("labels"))),
```

- [ ] **Step 2: Update `update` handler — pass `labelIds` to generateSearchTags**

In `convex/transactions.ts`, find the `generateSearchTags` call inside `update` (line 1438):

```typescript
// BEFORE (lines 1438-1441):
    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...newTx,
        categoryId: finalCategoryId as string | undefined,
    });

// AFTER:
    const { searchCategoryIds, searchLabelIds } = generateSearchTags({
        ...newTx,
        categoryId: finalCategoryId as string | undefined,
        labelIds: newTx.labelIds?.map(String),
        splits: newTx.splits?.map(s => ({
          ...s,
          labelIds: s.labelIds?.map(String),
        })),
    });
```

- [ ] **Step 3: Commit**

```bash
git add convex/transactions.ts
git commit -m "feat: transactions.update — labelIds array support"
```

---

## Task 7: Backend — Transaction Queries (Label Resolution)

**Files:**
- Modify: `convex/transactions.ts` (5 query functions)
- Modify: `convex/categories.ts` (lines ~290-350)
- Modify: `convex/dashboard.ts` (lines ~430-480)

- [ ] **Step 1: Update `getExpensesTrend` label collection (line ~195-240)**

Find the label collection block in `getExpensesTrend`:

```typescript
// BEFORE:
          const splitMatchesLabel = !labelId || labelId.length === 0 || (s.labelId && labelId.includes(s.labelId));

// AFTER:
          const splitMatchesLabel = !labelId || labelId.length === 0 || (s.labelIds?.some(id => labelId.includes(String(id))));
```

- [ ] **Step 2: Update `get` query — label collection (lines 395-409)**

Find the label ID collection block:

```typescript
// BEFORE (lines 402-408):
      if (t.labelId) labelIds.add(t.labelId);
      ...
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelId) labelIds.add(s.labelId);
      });

// AFTER:
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      ...
      t.splits?.forEach(s => {
        categoryIds.add(s.categoryId);
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
      });
```

- [ ] **Step 3: Update `get` query — label resolution (lines 427-439)**

```typescript
// BEFORE (lines 427, 433-439):
      const label = transaction.labelId ? labelMap.get(transaction.labelId) : null;
      ...
      const splitLabel = split.labelId ? labelMap.get(split.labelId) : null;
        return {
          ...split,
          categoryName: splitCategory?.name,
          labelName: splitLabel?.name,
          labelColor: splitLabel?.color,
        };

// AFTER:
      const labels = transaction.labelIds
        ? transaction.labelIds.map(id => labelMap.get(id)).filter(Boolean)
        : [];
      ...
      const splitLabels = split.labelIds
        ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
        : [];
        return {
          ...split,
          categoryName: splitCategory?.name,
          labelNames: splitLabels.map(l => l!.name),
          labelIcons: splitLabels.map(l => l!.icon),
        };
```

- [ ] **Step 4: Update `get` query — return object (line 447-456)**

```typescript
// BEFORE (lines 453-454):
        label: label || null,
        merchant: merchant || null,

// AFTER:
        labels: labels,
        merchant: merchant || null,
```

- [ ] **Step 5: Update `exportTransactions` — same pattern (lines 568-634)**

Apply the same label collection and resolution changes as in `get`:

```typescript
// Collection block (lines 574-578):
// BEFORE:
      if (t.labelId) labelIds.add(t.labelId);
      ...
        if (s.labelId) labelIds.add(s.labelId);

// AFTER:
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      ...
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
```

```typescript
// Resolution (lines 613-634):
// BEFORE:
                 const splitLabel = split.labelId ? labelMap.get(split.labelId) : null;
              ...
             const label = t.labelId ? labelMap.get(t.labelId) : null;

// AFTER:
                 const splitLabels = split.labelIds
                   ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
                   : [];
              ...
             const labels = t.labelIds
               ? t.labelIds.map(id => labelMap.get(id)).filter(Boolean)
               : [];
```

- [ ] **Step 6: Update `searchTransactions` — same pattern (lines 730-815)**

Apply the same label collection and resolution changes:

```typescript
// Collection (lines 737-741):
// BEFORE:
      if (t.labelId) labelIds.add(t.labelId);
      ...
        if (s.labelId) labelIds.add(s.labelId);

// AFTER:
      if (t.labelIds) t.labelIds.forEach(id => labelIds.add(id));
      ...
        if (s.labelIds) s.labelIds.forEach(id => labelIds.add(id));
```

```typescript
// Resolution (lines 769-815):
// BEFORE:
      const lblName = t.labelId ? labelMap.get(t.labelId)?.name : undefined;
      ...
          if (split.labelId) {
            const splitLblName = labelMap.get(split.labelId)?.name;
      ...
      const label = transaction.labelId ? labelMap.get(transaction.labelId) : null;
      ...
        const splitLabel = split.labelId ? labelMap.get(split.labelId) : null;

// AFTER:
      const lblNames = t.labelIds
        ? t.labelIds.map(id => labelMap.get(id)?.name).filter(Boolean)
        : [];
      ...
          if (split.labelIds) {
            const splitLblNames = split.labelIds.map(id => labelMap.get(id)?.name).filter(Boolean);
      ...
      const labels = transaction.labelIds
        ? transaction.labelIds.map(id => labelMap.get(id)).filter(Boolean)
        : [];
      ...
        const splitLabels = split.labelIds
          ? split.labelIds.map(id => labelMap.get(id)).filter(Boolean)
          : [];
```

- [ ] **Step 7: Update `categories.ts` — label resolution (lines ~290-350)**

Find the label collection and resolution in `convex/categories.ts`:

```typescript
// BEFORE (lines 300, 304):
        if (t.labelId) txLabelIds.add(t.labelId);
            if (s.labelId) txLabelIds.add(s.labelId);

// AFTER:
        if (t.labelIds) t.labelIds.forEach(id => txLabelIds.add(id));
            if (s.labelIds) s.labelIds.forEach(id => txLabelIds.add(id));
```

```typescript
// BEFORE (lines 326, 344-349):
            const label = t.labelId ? txLabelMap.get(t.labelId) : null;
                    const splitLabel = split.labelId ? txLabelMap.get(split.labelId) : null;
                        labelName: splitLabel?.name,
                        labelColor: splitLabel?.color,

// AFTER:
            const labels = t.labelIds
              ? t.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
              : [];
                    const splitLabels = split.labelIds
                      ? split.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
                      : [];
                        labelNames: splitLabels.map(l => l!.name),
                        labelIcons: splitLabels.map(l => l!.icon),
```

- [ ] **Step 8: Update `dashboard.ts` — label resolution (lines ~440-480)**

Same pattern as categories.ts:

```typescript
// BEFORE (lines 441, 446):
        if (t.labelId) txLabelIds.add(t.labelId);
            if (s.labelId) txLabelIds.add(s.labelId);

// AFTER:
        if (t.labelIds) t.labelIds.forEach(id => txLabelIds.add(id));
            if (s.labelIds) s.labelIds.forEach(id => txLabelIds.add(id));
```

```typescript
// BEFORE (lines 466, 471-476):
            const label = t.labelId ? txLabelMap.get(t.labelId) : null;
                    const splitLabel = split.labelId ? txLabelMap.get(split.labelId) : null;
                        labelName: splitLabel?.name,
                        labelColor: splitLabel?.color,

// AFTER:
            const labels = t.labelIds
              ? t.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
              : [];
                    const splitLabels = split.labelIds
                      ? split.labelIds.map(id => txLabelMap.get(id)).filter(Boolean)
                      : [];
                        labelNames: splitLabels.map(l => l!.name),
                        labelIcons: splitLabels.map(l => l!.icon),
```

- [ ] **Step 9: Commit**

```bash
git add convex/transactions.ts convex/categories.ts convex/dashboard.ts
git commit -m "feat: all query functions — labelIds array resolution"
```

---

## Task 8: Frontend — Types

**Files:**
- Modify: `components/transactions/types.ts`

- [ ] **Step 1: Update TransactionWithDetails type**

Replace the entire file `components/transactions/types.ts`:

```typescript
import { Doc, Id } from '../../convex/_generated/dataModel';

export type TransactionWithDetails = Omit<Doc<'transactions'>, 'splits' | 'accountId' | 'categoryId' | 'toAccountId' | 'labelIds' | 'merchantId'> & {
  accountId: Id<'accounts'>;
  categoryId?: Id<'categories'>;
  toAccountId?: Id<'accounts'>;
  labelIds?: Id<'labels'>[];
  merchantId?: Id<'merchants'>;
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  hideAmount: boolean;
  labels?: Doc<'labels'>[];
  merchant?: Doc<'merchants'> | null;
  splits?: Array<{
    categoryId: Id<'categories'>;
    amount: string;
    description?: string;
    labelIds?: Id<'labels'>[];
    categoryName?: string;
    labelNames?: string[];
    labelIcons?: string[];
  }>;
};
```

- [ ] **Step 2: Commit**

```bash
git add components/transactions/types.ts
git commit -m "feat: TransactionWithDetails — labels array + icons"
```

---

## Task 9: Frontend — LabelDrawer (Icon Picker)

**Files:**
- Modify: `components/LabelDrawer.tsx`

- [ ] **Step 1: Replace color picker with Lucide icon picker**

Replace the entire file `components/LabelDrawer.tsx`:

```typescript
import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Doc } from '../convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Loader2, Search } from 'lucide-react';
import {
  Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Tag, Hash, Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText,
} from 'lucide-react';

const ICON_LIST = [
  { name: 'Tag', Icon: Tag },
  { name: 'Home', Icon: Home },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Gift', Icon: Gift },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Gem', Icon: Gem },
  { name: 'Crown', Icon: Crown },
  { name: 'Flame', Icon: Flame },
  { name: 'Wallet', Icon: Wallet },
  { name: 'CreditCard', Icon: CreditCard },
  { name: 'Banknote', Icon: Banknote },
  { name: 'Coins', Icon: Coins },
  { name: 'PiggyBank', Icon: PiggyBank },
  { name: 'Receipt', Icon: Receipt },
  { name: 'DollarSign', Icon: DollarSign },
  { name: 'TrendingUp', Icon: TrendingUp },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Building', Icon: Building },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'Laptop', Icon: Laptop },
  { name: 'Code', Icon: Code },
  { name: 'Car', Icon: Car },
  { name: 'Bus', Icon: Bus },
  { name: 'Plane', Icon: Plane },
  { name: 'Train', Icon: Train },
  { name: 'Bike', Icon: Bike },
  { name: 'Ship', Icon: Ship },
  { name: 'Fuel', Icon: Fuel },
  { name: 'Coffee', Icon: Coffee },
  { name: 'UtensilsCrossed', Icon: UtensilsCrossed },
  { name: 'ShoppingBag', Icon: ShoppingBag },
  { name: 'Apple', Icon: Apple },
  { name: 'Beer', Icon: Beer },
  { name: 'Cake', Icon: Cake },
  { name: 'Activity', Icon: Activity },
  { name: 'Pill', Icon: Pill },
  { name: 'Stethoscope', Icon: Stethoscope },
  { name: 'Dumbbell', Icon: Dumbbell },
  { name: 'Moon', Icon: Moon },
  { name: 'Users', Icon: Users },
  { name: 'User', Icon: User },
  { name: 'Baby', Icon: Baby },
  { name: 'PawPrint', Icon: PawPrint },
  { name: 'Clock', Icon: Clock },
  { name: 'MapPin', Icon: MapPin },
  { name: 'Phone', Icon: Phone },
  { name: 'Music', Icon: Music },
  { name: 'Camera', Icon: Camera },
  { name: 'Umbrella', Icon: Umbrella },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Hammer', Icon: Hammer },
  { name: 'Palette', Icon: Palette },
  { name: 'Zap', Icon: Zap },
  { name: 'Globe', Icon: Globe },
  { name: 'Bookmark', Icon: Bookmark },
  { name: 'Shield', Icon: Shield },
  { name: 'Folder', Icon: Folder },
  { name: 'FileText', Icon: FileText },
];

// Map name to component for dynamic rendering
const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_LIST.map(({ name, Icon }) => [name, Icon])
);

const LabelFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  icon: z.string().min(1, 'Icon is required'),
});

type LabelFormValues = z.infer<typeof LabelFormSchema>;

type LabelDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: Doc<'labels'>;
};

const LabelDrawer = ({ open, onOpenChange, label }: LabelDrawerProps) => {
  const { householdId } = useHousehold();
  const createLabel = useMutation(api.labels.create);
  const updateLabel = useMutation(api.labels.update);

  const isEditMode = !!label;
  const [isProcessing, setIsProcessing] = React.useState(false);
  const submitLock = React.useRef(false);
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<LabelFormValues>({
    resolver: zodResolver(LabelFormSchema),
  });

  const { formState: { isSubmitting } } = form;

  const filteredIcons = useMemo(() => {
    if (!searchQuery) return ICON_LIST;
    const q = searchQuery.toLowerCase();
    return ICON_LIST.filter(({ name }) => name.toLowerCase().includes(q));
  }, [searchQuery]);

  useEffect(() => {
    if (open) {
      setIsProcessing(false);
      submitLock.current = false;
      setSearchQuery('');

      if (isEditMode) {
        form.reset({ name: label.name, icon: label.icon });
      } else {
        form.reset({ name: '', icon: 'Tag' });
      }
    }
  }, [open, isEditMode, label, form]);

  const onSubmit = async (data: LabelFormValues) => {
    if (submitLock.current || isProcessing) return;

    try {
      submitLock.current = true;
      setIsProcessing(true);

      if (isEditMode) {
        await updateLabel({ id: label._id, ...data });
      } else {
        await createLabel({ ...data, householdId: householdId ?? undefined });
      }
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      submitLock.current = false;
    }
  };

  const selectedIcon = form.watch('icon');
  const SelectedIconComponent = ICON_MAP[selectedIcon] || Tag;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{isEditMode ? 'Edit Label' : 'Create a new Label'}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Work" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Icon</FormLabel>
                    <FormControl>
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search icons..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-9"
                          />
                        </div>
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[200px] overflow-y-auto">
                          {filteredIcons.map(({ name, Icon }) => (
                            <button
                              key={name}
                              type="button"
                              className={cn(
                                "h-10 w-10 rounded-lg flex items-center justify-center transition-all hover:bg-muted active:scale-95",
                                field.value === name
                                  ? "bg-primary/10 ring-2 ring-primary"
                                  : "bg-muted/50"
                              )}
                              onClick={() => field.onChange(name)}
                              title={name}
                            >
                              <Icon
                                className={cn(
                                  "h-4 w-4",
                                  field.value === name
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Preview:</span>
                <SelectedIconComponent className="h-4 w-4" />
                <span className="font-medium text-foreground">{form.watch('name') || 'Label'}</span>
              </div>
              <DrawerFooter className="px-0 pt-2">
                <Button
                  type="submit"
                  disabled={isProcessing}
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                  }}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline" disabled={isProcessing}>Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default LabelDrawer;
```

- [ ] **Step 2: Commit**

```bash
git add components/LabelDrawer.tsx
git commit -m "feat: LabelDrawer — icon picker replaces color picker"
```

---

## Task 10: Frontend — Labels Management Page

**Files:**
- Modify: `app/labels/page.tsx`

- [ ] **Step 1: Update page to show icon-based compact list**

Replace the labels list rendering in `app/labels/page.tsx`. Find the `labels.map` block (line 100) and replace:

```typescript
// BEFORE (lines 100-129):
            {labels.map(label => (
              <Card key={label._id} className="p-4 flex flex-row justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                  <div
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <p className="font-medium">{label.name}</p>
                </div>
                <DropdownMenu>
                  ...
                </DropdownMenu>
              </Card>
            ))}

// AFTER:
            {labels.map(label => {
              const LabelIcon = ICON_MAP[label.icon] || Tag;
              return (
                <Card key={label._id} className="p-3 flex flex-row justify-between items-center shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <LabelIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-sm">{label.name}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(label)}>
                        <EditIcon className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setLabelToDelete(label)}
                      >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Card>
              );
            })}
```

Also add the icon imports at the top of the file:

```typescript
import {
  Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Tag, Hash, Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  DollarSign, TrendingUp, BarChart3, Briefcase, Building,
  GraduationCap, BookOpen, Laptop, Code, Car, Bus, Plane,
  Train, Bike, Ship, Fuel, Coffee, UtensilsCrossed, ShoppingBag,
  Apple, Beer, Cake, Activity, Pill, Stethoscope, Dumbbell,
  Moon, Users, User, Baby, PawPrint, Clock, MapPin, Phone,
  Music, Camera, Umbrella, Wrench, Hammer, Palette, Zap,
  Globe, Bookmark, Shield, Folder, FileText, Hash,
};
```

- [ ] **Step 2: Commit**

```bash
git add app/labels/page.tsx
git commit -m "feat: labels page — compact icon-based list"
```

---

## Task 11: Frontend — TransactionDrawer (Multi-Label)

**Files:**
- Modify: `components/TransactionDrawer.tsx`

- [ ] **Step 1: Update form schema — `labelId` → `labelIds` (array)**

Find the form schema (line 130):

```typescript
// BEFORE (line 130):
  labelId: z.string().optional(),
  ...
    labelId: z.string().optional(),

// AFTER:
  labelIds: z.array(z.string()).optional(),
  ...
    labelIds: z.array(z.string()).optional(),
```

- [ ] **Step 2: Update form reset — edit mode (lines 571-573)**

```typescript
// BEFORE (lines 571-573):
            labelId: s.labelId || undefined,
          })) || [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: transaction.labelId || undefined,

// AFTER:
            labelIds: s.labelIds || [],
          })) || [{ categoryId: '', amount: '', description: '', labelIds: [] }],
          labelIds: transaction.labelIds || [],
```

- [ ] **Step 3: Update form reset — create mode (lines 594-595)**

```typescript
// BEFORE (lines 594-595):
          splits: initialData?.splits || [{ categoryId: '', amount: '', description: '', labelId: '' }],
          labelId: initialData?.labelId || undefined,

// AFTER:
          splits: initialData?.splits || [{ categoryId: '', amount: '', description: '', labelIds: [] }],
          labelIds: initialData?.labelIds || [],
```

- [ ] **Step 4: Update `selectedLabel` watch (if exists)**

Find the `selectedLabel` variable (around line 547 area, used for MobileInputCard display):

```typescript
// BEFORE:
  const selectedLabel = labels?.find(l => l._id === form.watch('labelId'));

// AFTER:
  const selectedLabelIds = form.watch('labelIds') || [];
  const selectedLabels = labels?.filter(l => selectedLabelIds.includes(l._id)) || [];
```

- [ ] **Step 5: Update `onSubmit` — splits labelIds (line 638)**

```typescript
// BEFORE (line 638):
          labelId: (s.labelId && s.labelId !== 'none' && s.labelId !== "") ? s.labelId as Id<'labels'> : undefined,

// AFTER:
          labelIds: (s.labelIds || []).filter(Boolean) as Id<'labels'>[],
```

- [ ] **Step 6: Update `onSubmit` — root labelIds (line 658)**

```typescript
// BEFORE (line 658):
              labelId: (data.labelId && data.labelId !== 'none') ? data.labelId as Id<'labels'> : undefined,

// AFTER:
              labelIds: (data.labelIds || []).filter(Boolean) as Id<'labels'>[],
```

- [ ] **Step 7: Update mobile label selector — multi-select**

Find the mobile `FormField` for `labelId` (lines 1162-1191). Replace with multi-select chips:

```typescript
// BEFORE (lines 1162-1191):
                    {!isSplit && (
                        <FormField
                            control={form.control}
                            name="labelId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MobileSelectionDrawer
                                            title="Select Label"
                                            value={field.value}
                                            onSelect={field.onChange}
                                            options={[
                                                { value: 'none', label: 'None' },
                                                ...(labels?.map(lbl => ({
                                                    value: lbl._id,
                                                    label: lbl.name
                                                })) || [])
                                            ]}
                                            trigger={
                                                <button type="button" className="w-full text-left outline-none">
                                                    <MobileInputCard label="Label" icon={Tag} valueDisplay={selectedLabel?.name || "None"} />
                                                </button>
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

// AFTER:
                    {!isSplit && (
                        <FormField
                            control={form.control}
                            name="labelIds"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <MobileSelectionDrawer
                                            title="Select Labels"
                                            value=""
                                            onSelect={(val) => {
                                                if (val === 'none') {
                                                  field.onChange([]);
                                                } else {
                                                  const current = field.value || [];
                                                  const next = current.includes(val)
                                                    ? current.filter(id => id !== val)
                                                    : [...current, val];
                                                  field.onChange(next);
                                                }
                                            }}
                                            options={[
                                                { value: 'none', label: 'None (clear all)' },
                                                ...(labels?.map(lbl => ({
                                                    value: lbl._id,
                                                    label: lbl.name
                                                })) || [])
                                            ]}
                                            trigger={
                                                <button type="button" className="w-full text-left outline-none">
                                                    <MobileInputCard
                                                      label="Labels"
                                                      icon={Tag}
                                                      valueDisplay={
                                                        selectedLabels.length > 0
                                                          ? selectedLabels.map(l => l.name).join(', ')
                                                          : 'None'
                                                      }
                                                    />
                                                </button>
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
```

- [ ] **Step 8: Update desktop label selector — multi-select chips**

Find the desktop `FormField` for `labelId` (lines 1481-1501). Replace with a multi-select pattern:

```typescript
// BEFORE (lines 1481-1501):
                    <FormField
                        control={form.control}
                        name="labelId"
                        render={({ field }) => (
                        <FormItem>
                                        <FormLabel>Label</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select a label (optional)" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {labels?.map(label => (
                                <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

// AFTER:
                    <FormField
                        control={form.control}
                        name="labelIds"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Labels</FormLabel>
                            <div className="flex flex-wrap gap-1.5 min-h-[36px]">
                              {(field.value || []).map((id: string) => {
                                const lbl = labels?.find(l => l._id === id);
                                if (!lbl) return null;
                                const LabelIcon = ICON_MAP[lbl.icon] || Tag;
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-1 rounded-md"
                                  >
                                    <LabelIcon className="h-3 w-3" />
                                    {lbl.name}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        field.onChange((field.value || []).filter((v: string) => v !== id));
                                      }}
                                      className="ml-0.5 hover:text-destructive"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                              <Select
                                onValueChange={(val) => {
                                  if (val && val !== 'none') {
                                    field.onChange([...(field.value || []), val]);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-auto px-2 text-xs">
                                  <SelectValue placeholder="+ Add" />
                                </SelectTrigger>
                                <SelectContent>
                                  {labels?.filter(l => !(field.value || []).includes(l._id)).map(label => (
                                    <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
```

- [ ] **Step 9: Add ICON_MAP import**

Add to imports in `components/TransactionDrawer.tsx`:

```typescript
import {
  // ... existing imports
  Tag,
  Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText, Hash,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  DollarSign, TrendingUp, BarChart3, Briefcase, Building,
  GraduationCap, BookOpen, Laptop, Code, Car, Bus, Plane,
  Train, Bike, Ship, Fuel, Coffee, UtensilsCrossed, ShoppingBag,
  Apple, Beer, Cake, Activity, Pill, Stethoscope, Dumbbell,
  Moon, Users, User, Baby, PawPrint, Clock, MapPin, Phone,
  Music, Camera, Umbrella, Wrench, Hammer, Palette, Zap,
  Globe, Bookmark, Shield, Folder, FileText, Hash,
};
```

- [ ] **Step 10: Commit**

```bash
git add components/TransactionDrawer.tsx
git commit -m "feat: TransactionDrawer — multi-label select"
```

---

## Task 12: Frontend — SplitEditorDrawer (Multi-Label)

**Files:**
- Modify: `components/SplitEditorDrawer.tsx`

- [ ] **Step 1: Update mobile label selector (lines 267-296)**

Find the mobile `FormField` for `splits.${index}.labelId`:

```typescript
// BEFORE (lines 267-296):
                            <FormField
                                control={form.control}
                                name={`splits.${index}.labelId`}
                                render={({ field }) => {
                                     const selectedLabel = labels?.find(l => l._id === field.value);
                                     return (
                                        <FormItem>
                                            <FormControl>
                                                <MobileSelectionDrawer
                                                    title="Select Label"
                                                    value={field.value}
                                                    onSelect={field.onChange}
                                                    options={[
                                                        { value: 'none', label: 'None' },
                                                        ...(labels?.map(lbl => ({
                                                            value: lbl._id,
                                                            label: lbl.name
                                                        })) || [])
                                                    ]}
                                                    trigger={
                                                        <button type="button" className="w-full text-left outline-none">
                                                            <MobileInputCard label="Label" icon={Tag} valueDisplay={selectedLabel?.name || "None"} />
                                                        </button>
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                     );
                                }}
                            />

// AFTER:
                            <FormField
                                control={form.control}
                                name={`splits.${index}.labelIds`}
                                render={({ field }) => {
                                     const selectedIds = field.value || [];
                                     const selectedLabels = labels?.filter(l => selectedIds.includes(l._id)) || [];
                                     return (
                                        <FormItem>
                                            <FormControl>
                                                <MobileSelectionDrawer
                                                    title="Select Labels"
                                                    value=""
                                                    onSelect={(val) => {
                                                        if (val === 'none') {
                                                          field.onChange([]);
                                                        } else {
                                                          const next = selectedIds.includes(val)
                                                            ? selectedIds.filter((id: string) => id !== val)
                                                            : [...selectedIds, val];
                                                          field.onChange(next);
                                                        }
                                                    }}
                                                    options={[
                                                        { value: 'none', label: 'None (clear all)' },
                                                        ...(labels?.map(lbl => ({
                                                            value: lbl._id,
                                                            label: lbl.name
                                                        })) || [])
                                                    ]}
                                                    trigger={
                                                        <button type="button" className="w-full text-left outline-none">
                                                            <MobileInputCard
                                                              label="Labels"
                                                              icon={Tag}
                                                              valueDisplay={
                                                                selectedLabels.length > 0
                                                                  ? selectedLabels.map(l => l.name).join(', ')
                                                                  : 'None'
                                                              }
                                                            />
                                                        </button>
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                     );
                                }}
                            />
```

- [ ] **Step 2: Update desktop label selector (lines 394-413)**

Find the desktop `FormField` for `splits.${index}.labelId`:

```typescript
// BEFORE (lines 394-413):
                                    <FormField
                                    control={form.control}
                                    name={`splits.${index}.labelId`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} value={field.value} key={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Label (opt)" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {labels?.map(label => (
                                                        <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

// AFTER:
                                    <FormField
                                    control={form.control}
                                    name={`splits.${index}.labelIds`}
                                    render={({ field }) => {
                                        const selectedIds = field.value || [];
                                        return (
                                        <FormItem>
                                            <div className="flex flex-wrap gap-1 min-h-[36px]">
                                              {selectedIds.map((id: string) => {
                                                const lbl = labels?.find(l => l._id === id);
                                                if (!lbl) return null;
                                                return (
                                                  <span key={id} className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                                    {lbl.name}
                                                    <button type="button" onClick={() => {
                                                      field.onChange(selectedIds.filter((v: string) => v !== id));
                                                    }} className="hover:text-destructive">×</button>
                                                  </span>
                                                );
                                              })}
                                              <Select onValueChange={(val) => {
                                                if (val) field.onChange([...selectedIds, val]);
                                              }}>
                                                <SelectTrigger className="h-7 w-auto px-2 text-xs">
                                                  <SelectValue placeholder="+ Add" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {labels?.filter(l => !selectedIds.includes(l._id)).map(label => (
                                                    <SelectItem key={label._id} value={label._id}>{label.name}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                        </FormItem>
                                        );
                                    }}
                                />
```

- [ ] **Step 3: Update `append` default value (line 426)**

```typescript
// BEFORE (line 426):
            onClick={() => append({ categoryId: '', amount: '', description: '', labelId: '' })}

// AFTER:
            onClick={() => append({ categoryId: '', amount: '', description: '', labelIds: [] })}
```

- [ ] **Step 4: Commit**

```bash
git add components/SplitEditorDrawer.tsx
git commit -m "feat: SplitEditorDrawer — multi-label per split"
```

---

## Task 13: Frontend — TransactionItem (Multi-Label Badge)

**Files:**
- Modify: `components/TransactionItem.tsx`

- [ ] **Step 1: Update label display — collapsed view (lines 139-152)**

Find the label badge in collapsed view:

```typescript
// BEFORE (lines 139-152):
            {transaction.label && (
              <div className="flex justify-end mt-1">
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 h-4 border-0 bg-muted/50 text-muted-foreground font-normal hover:bg-muted"
                  style={transaction.label.color ? { 
                      color: transaction.label.color,
                      backgroundColor: `${transaction.label.color}15`
                  } : undefined}
                >
                  #{transaction.label.name}
                </Badge>
              </div>
            )}

// AFTER:
            {transaction.labels && transaction.labels.length > 0 && (
              <div className="flex justify-end mt-1 gap-1 flex-wrap">
                {transaction.labels.map((lbl) => {
                  const LabelIcon = ICON_MAP[lbl.icon] || Tag;
                  return (
                    <span
                      key={lbl._id}
                      className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    >
                      <LabelIcon className="h-3 w-3" />
                      {lbl.name}
                    </span>
                  );
                })}
              </div>
            )}
```

- [ ] **Step 2: Update label display — expanded splits view (lines 214-227)**

Find the label badge in split items:

```typescript
// BEFORE (lines 214-227):
                      {split.labelName && (
                        <div className="flex justify-end mt-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 h-4 border-0 bg-muted/50 text-muted-foreground font-normal hover:bg-muted"
                            style={split.labelColor ? { 
                                color: split.labelColor,
                                backgroundColor: `${split.labelColor}15`
                            } : undefined}
                          >
                            #{split.labelName}
                          </Badge>
                        </div>
                      )}

// AFTER:
                      {split.labelNames && split.labelNames.length > 0 && (
                        <div className="flex justify-end mt-1 gap-1">
                          {split.labelNames.map((name, i) => {
                            const iconName = split.labelIcons?.[i] || 'Tag';
                            const LabelIcon = ICON_MAP[iconName] || Tag;
                            return (
                              <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <LabelIcon className="h-3 w-3" />
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      )}
```

- [ ] **Step 3: Update label filter matching (lines 41, 200)**

Find the filter matching for labels:

```typescript
// BEFORE (line 41):
      const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelId && highlightLabelId.includes(String(split.labelId)));

// AFTER:
      const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
```

```typescript
// BEFORE (line 200):
                const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelId && highlightLabelId.includes(String(split.labelId)));

// AFTER:
                const labelMatch = !highlightLabelId || highlightLabelId.length === 0 || (split.labelIds?.some(id => highlightLabelId.includes(String(id))));
```

- [ ] **Step 4: Add icon imports**

Add to imports in `components/TransactionItem.tsx`:

```typescript
import {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText, Hash,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  DollarSign, TrendingUp, BarChart3, Briefcase, Building,
  GraduationCap, BookOpen, Laptop, Code, Car, Bus, Plane,
  Train, Bike, Ship, Fuel, Coffee, UtensilsCrossed, ShoppingBag,
  Apple, Beer, Cake, Activity, Pill, Stethoscope, Dumbbell,
  Moon, Users, User, Baby, PawPrint, Clock, MapPin, Phone,
  Music, Camera, Umbrella, Wrench, Hammer, Palette, Zap,
  Globe, Bookmark, Shield, Folder, FileText, Hash,
};
```

- [ ] **Step 5: Commit**

```bash
git add components/TransactionItem.tsx
git commit -m "feat: TransactionItem — multi-label badges with icons"
```

---

## Task 14: Frontend — TransactionFilters

**Files:**
- Modify: `components/TransactionFilters.tsx`

- [ ] **Step 1: Update label badge display (lines 198-203)**

Find the label filter badge rendering:

```typescript
// BEFORE (lines 198-203):
          {filters.labelId?.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Lbl: {labelOptions.find(o => o.value === id)?.label || id}
              <button onClick={() => onFilterChange({ ...filters, labelId: filters.labelId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}

// AFTER:
          {filters.labelId?.map(id => {
            const lbl = labels?.find(l => l._id === id);
            const LabelIcon = lbl ? (ICON_MAP[lbl.icon] || Tag) : Tag;
            return (
              <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
                <LabelIcon className="h-3 w-3" />
                {labelOptions.find(o => o.value === id)?.label || id}
                <button onClick={() => onFilterChange({ ...filters, labelId: filters.labelId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            );
          })}
```

- [ ] **Step 2: Add icon imports**

Add to imports in `components/TransactionFilters.tsx`:

```typescript
import {
  Filter, X, Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText, Hash,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  DollarSign, TrendingUp, BarChart3, Briefcase, Building,
  GraduationCap, BookOpen, Laptop, Code, Car, Bus, Plane,
  Train, Bike, Ship, Fuel, Coffee, UtensilsCrossed, ShoppingBag,
  Apple, Beer, Cake, Activity, Pill, Stethoscope, Dumbbell,
  Moon, Users, User, Baby, PawPrint, Clock, MapPin, Phone,
  Music, Camera, Umbrella, Wrench, Hammer, Palette, Zap,
  Globe, Bookmark, Shield, Folder, FileText, Hash,
};
```

- [ ] **Step 3: Commit**

```bash
git add components/TransactionFilters.tsx
git commit -m "feat: TransactionFilters — label badges with icons"
```

---

## Task 15: Run Migration & Verify

- [ ] **Step 1: Deploy schema changes**

```bash
npx convex deploy
```

- [ ] **Step 2: Run migration from Convex Dashboard**

Go to Convex Dashboard → Functions → `migrations:migrateLabelsToIconAndMultiLabel` → Execute

- [ ] **Step 3: Verify labels migrated**

Check `labels` table — all should have `icon: "Tag"`, no `color` field.

- [ ] **Step 4: Verify transactions migrated**

Check `transactions` table — all should have `labelIds` array (not `labelId`).

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

- [ ] **Step 6: Run dev and test manually**

```bash
npm run dev --webpack
```

Test:
1. Create new label with icon → should appear in list with icon
2. Edit existing label → change icon
3. Create transaction → select multiple labels
4. Edit transaction → labels pre-populated
5. Filter by label → matches work
6. Check transaction list → badges show icons
7. Check dashboard → labels resolve correctly

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: label redesign complete — multi-label + icon system"
```

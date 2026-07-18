# Label Redesign: Multi-Label + Icon System

## Summary

Redesign the label system to support multiple labels per transaction and replace the color-based visual with Lucide icons for a more minimal, modern look.

## Goals

1. Transactions can have multiple labels (currently limited to 1)
2. Replace color-based label visuals with Lucide icons
3. Minimal, subtle badge design for label display
4. Migrate existing data cleanly

---

## Schema Changes

### Labels Table

**Before:**
```ts
labels: defineTable({
  userId: v.string(),
  householdId: v.optional(v.id("households")),
  name: v.string(),
  color: v.string(),  // hex color like "#ef4444"
})
```

**After:**
```ts
labels: defineTable({
  userId: v.string(),
  householdId: v.optional(v.id("households")),
  name: v.string(),
  icon: v.string(),  // lucide icon name like "Briefcase", "Home", "Tag"
})
```

- `color` field removed
- `icon` field added (string — lucide icon component name)
- Default icon: `"Tag"` for migration and new labels

### Transactions Table

**Before:**
```ts
labelId: v.optional(v.id("labels"))  // single label
searchLabelIds: v.optional(v.array(v.string()))  // denormalized for filtering
```

**After:**
```ts
labelIds: v.optional(v.array(v.id("labels")))  // multiple labels
searchLabelIds: v.optional(v.array(v.string()))  // unchanged, still denormalized flat array
```

- `labelId` (single) removed
- `labelIds` (array) added
- `searchLabelIds` stays the same — flattened array of all label IDs from the transaction + splits
- Composite indexes (`by_search_label`, `by_household_search_label`) remain valid

### Splits (embedded in transactions)

Each split item keeps its own label reference:

**Before:**
```ts
splits: v.array(v.object({
  labelId: v.optional(v.id("labels")),
  // ...
}))
```

**After:**
```ts
splits: v.array(v.object({
  labelIds: v.optional(v.array(v.id("labels"))),
  // ...
}))
```

---

## Data Migration

### Function: `convex/migrations/migrateLabels.ts`

One-time internal mutation to migrate existing data:

1. **Labels:** For each label, remove `color` field, add `icon: "Tag"` (default)
2. **Transactions (root):** Convert `labelId: "abc"` → `labelIds: ["abc"]`; `null` → `[]`
3. **Transactions (splits):** Same conversion per split item
4. **SearchLabelIds:** Recompute from new `labelIds` arrays

**Safety:**
- Idempotent — running twice won't break anything
- Uses batch processing with limits to avoid timeouts
- Returns count of migrated documents

---

## Lucide Icon Picker

### Available Icons (~50 curated)

Organized by category for easy discovery:

**Lifestyle:** Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame
**Money:** Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt, DollarSign
**Work:** Briefcase, Building, GraduationCap, BookOpen, Laptop, Code
**Transport:** Car, Bus, Plane, Train, Bike, Ship, Fuel
**Food:** Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake
**Health:** Heart, Activity, Pill, Stethoscope, Dumbbell, Moon
**People:** Users, User, Baby, PawPrint, UsersRound
**Misc:** Tag, Hash, Clock, MapPin, Phone, Music, Camera, Plane, Umbrella, Wrench, Hammer, Palette

### Picker UX

- Grid layout (5 columns on mobile, 6 on desktop)
- Search input at top to filter icons by name
- Selected icon highlighted with ring
- Click to select, drawer closes on save

---

## UI Changes

### Label Badge (TransactionItem)

**Before:**
```html
<Badge style="background: color@15%; color: color">#label_name</Badge>
```

**After:**
```html
<span class="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
  <Icon class="h-3 w-3" style="color: label-color-from-icon" />
  label_name
</span>
```

- Icon rendered via `<动态组件>` from lucide-react
- Text colored with `text-muted-foreground` (subtle)
- No background, no border, no hash prefix
- Multiple labels displayed inline with small gap

**Multi-label display:**
```
🏷️ Work  🏷️ Reimbursable  🏷️ Travel
```

### Labels Management Page (`/labels`)

**Before:** Card with large colored circle + name

**After:** Compact row with icon + name

```html
<div class="flex items-center gap-3 p-3">
  <Icon class="h-4 w-4 text-muted-foreground" />
  <span class="font-medium text-sm">label_name</span>
  <!-- dropdown menu -->
</div>
```

- Grid layout: 2 columns on mobile, 3 on desktop
- Each item: icon + name + edit/delete dropdown

### LabelDrawer (Create/Edit)

**Before:** Text input + 10 color circles

**After:** Text input + icon picker grid

- Name field (same as before)
- Icon picker: searchable grid of ~50 lucide icons
- Search input with placeholder "Search icons..."
- Selected icon has ring highlight
- Default for new labels: `"Tag"` icon

### Transaction Form (Label Selection)

**Before:** Single select dropdown/drawer

**After:** Multi-select chip-style

- **Mobile:** Tap to open selection drawer, checkboxes for each label
- **Desktop:** Multi-select with chips showing selected labels
- Each selected label shown as small chip with icon + name + X to remove
- "None" option to clear all labels

### Split Editor (Label per Split)

**Before:** Single select per split

**After:** Multi-select per split (same pattern as root transaction)

### Transaction Filters

**Before:** Multi-select by label (matches any single label)

**After:** Multi-select by label (matches transactions that have ANY of the selected labels)

- Same UX, but now matches against the array of labels
- Filter logic: transaction matches if `searchLabelIds` intersects with selected filter labels

---

## Backend Changes

### Convex Functions to Update

| File | Function | Change |
|------|----------|--------|
| `convex/labels.ts` | `get`, `create`, `update`, `deleteLabel` | Replace `color` with `icon` in args/types |
| `convex/transactions.ts` | `create`, `update` | Convert `labelId` → `labelIds` array handling |
| `convex/transactions.ts` | `get`, `searchTransactions`, `exportTransactions` | Update label resolution to handle array |
| `convex/transactions.ts` | `getExpensesTrend` | Update label filtering for array |
| `convex/categories.ts` | category detail query | Update label resolution |
| `convex/dashboard.ts` | recent transactions | Update label resolution |
| `convex/lib/transactions.ts` | `generateSearchTags()` | Flatten `labelIds` + `splits[].labelIds` into `searchLabelIds` |

### Label Resolution Pattern

Currently: `labelMap.get(t.labelId)` → single label

After: `t.labelIds?.map(id => labelMap.get(id)).filter(Boolean)` → array of labels

All queries that resolve labels need to:
1. Collect all unique label IDs from `labelIds` arrays (root + splits)
2. Batch fetch labels
3. Attach resolved labels array to response

---

## Frontend Components to Update

| Component | Change |
|-----------|--------|
| `components/LabelDrawer.tsx` | Replace color picker with icon picker |
| `app/labels/page.tsx` | Update card design to show icon instead of color circle |
| `components/TransactionDrawer.tsx` | Multi-select labels, update form schema |
| `components/SplitEditorDrawer.tsx` | Multi-select labels per split |
| `components/TransactionItem.tsx` | Display multiple label badges with icons |
| `components/TransactionFilters.tsx` | Update filter logic for multi-label matching |
| `components/transactions/types.ts` | Update `TransactionWithDetails` type |
| `components/transactions/TransactionAnalytics.tsx` | Update label filter passing |
| `components/transactions/ExportTransactionDialog.tsx` | Update label filter passing |
| `components/skeletons.tsx` | Update `LabelsListSkeleton` |

---

## Type Updates

```ts
// components/transactions/types.ts
type TransactionWithDetails = {
  // ...
  labelIds?: Id<'labels'>[];
  labels?: Doc<'labels'>[];  // resolved array
  splits?: Array<{
    labelIds?: Id<'labels'>[];
    labelNames?: string[];   // resolved
    labelIcons?: string[];   // resolved
    // ...
  }>;
};
```

---

## Edge Cases

1. **Empty labelIds:** Transaction displays without any label badge (same as current no-label state)
2. **Deleted label:** If a label is deleted, its ID remains in `labelIds` but won't resolve — badge not shown for that label
3. **Migration default:** All existing labels get `icon: "Tag"` — user can update later
4. **Household labels:** Same rules apply — admin-only creation, shared across household
5. **Search:** `searchLabelIds` already handles array flattening — no change needed for text search

---

## Implementation Order

1. Schema migration function
2. Backend: labels.ts (icon field)
3. Backend: transactions.ts (labelIds array)
4. Backend: lib/transactions.ts (generateSearchTags)
5. Backend: all query functions (label resolution)
6. Frontend: LabelDrawer (icon picker)
7. Frontend: labels/page.tsx (compact design)
8. Frontend: TransactionDrawer (multi-select)
9. Frontend: SplitEditorDrawer (multi-select)
10. Frontend: TransactionItem (multi-label badge)
11. Frontend: TransactionFilters (multi-label matching)
12. Frontend: types.ts updates
13. Run migration

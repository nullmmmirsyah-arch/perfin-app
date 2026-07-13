# Merchant/Payee Feature Design

**Date:** 2026-07-13  
**Status:** Approved  

## Overview

Add merchant/payee functionality to Perfin for tracking spending patterns and enabling quick transaction entry. This follows the Label-like approach (simple CRUD with name + icon).

## Requirements

1. **Track spending patterns by merchant** - Know where you spend money most
2. **Quick entry with merchant templates** - Auto-fill category/description when selecting merchant
3. **Full merchant profiles** - Name + icon for visual identification
4. **Dropdown selection in transaction form** - Like Category/Label selectors
5. **Auto-create option** - Type new merchant name and create inline
6. **Household support** - Merchants shared within household only
7. **Dedicated management page** - CRUD operations in Settings
8. **No merchant detail page** - Just list page for management (future enhancement)

## Database Schema

### New Table: `merchants`

```typescript
merchants: defineTable({
  userId: v.string(),
  householdId: v.id("households"), // Required - merchants are household-only
  name: v.string(),
  icon: v.string(), // Emoji or icon identifier
})
  .index("by_householdId", ["householdId"])
  .index("by_userId", ["userId"])
  .index("by_householdId_name", ["householdId", "name"]), // For uniqueness check
```

### Modified Table: `transactions`

Add optional `merchantId` field:

```typescript
// In transactions table definition
merchantId: v.optional(v.id("merchants")),
```

## API Endpoints

### `convex/merchants.ts`

```typescript
// Query: Get all merchants for household
export const get = query({
  args: { householdId: v.optional(v.id("households")) },
  handler: async (ctx, { householdId }) => { ... }
});

// Mutation: Create new merchant
export const create = mutation({
  args: {
    householdId: v.id("households"),
    name: v.string(),
    icon: v.string(),
  },
  handler: async (ctx, args) => { ... }
});

// Mutation: Update merchant
export const update = mutation({
  args: {
    id: v.id("merchants"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => { ... }
});

// Mutation: Delete merchant
export const deleteMerchant = mutation({
  args: { id: v.id("merchants") },
  handler: async (ctx, args) => { ... }
});
```

## UI Components

### 1. Merchant Management Page (`app/settings/merchants/page.tsx`)

- Grid of merchant cards (icon + name)
- Add new merchant button
- Edit/Delete actions per card
- Search/filter functionality

### 2. Merchant Drawer (`components/MerchantDrawer.tsx`)

- Create/Edit form with:
  - Name input (required)
  - Icon picker (emoji grid)
- Follows existing drawer patterns (LabelDrawer.tsx)

### 3. Transaction Form Integration (`components/TransactionDrawer.tsx`)

- Add merchant dropdown field
- Searchable select with "Create new" option
- When typing new name: show "Add [name] as new merchant?" option

### 4. Settings Navigation

- Add "Merchants" link to Settings section
- Icon: Store or Building2 from lucide-react

## Data Flow

1. **Transaction Creation:**
   - User selects merchant from dropdown OR types new name
   - If new: Create merchant first, then link to transaction
   - Store `merchantId` in transaction

2. **Transaction Display:**
   - Fetch merchant details alongside account/category/label
   - Show merchant icon + name in transaction list

3. **Merchant Management:**
   - CRUD operations with household access checks
   - Admin-only delete (like Labels)

## Implementation Steps

### Phase 1: Backend
1. Add `merchants` table to schema
2. Add `merchantId` to transactions table
3. Create `convex/merchants.ts` with CRUD operations
4. Update transaction queries to include merchant details

### Phase 2: Frontend - Merchant Management
1. Create `MerchantDrawer.tsx` component
2. Create `app/settings/merchants/page.tsx`
3. Add navigation link to Settings

### Phase 3: Transaction Integration
1. Add merchant dropdown to `TransactionDrawer.tsx`
2. Implement auto-create functionality
3. Update `TransactionItem.tsx` to display merchant

### Phase 4: Polish
1. Add icon picker UI
2. Implement search/filter for merchants
3. Test household access patterns

## Design Decisions

1. **Household-only merchants** - Simplifies data model, avoids personal merchant duplication
2. **No split support** - Merchants are transaction-level, not split-level (like accounts)
3. **Icon as emoji string** - Simple, no external dependencies, works cross-platform
4. **Auto-create in dropdown** - Reduces friction for new merchants

## Future Enhancements

- Merchant detail page with spending analytics
- Merchant spending trends and charts
- Default category/description templates per merchant
- Import merchants from CSV
- Merchant icons from image upload (not just emoji)

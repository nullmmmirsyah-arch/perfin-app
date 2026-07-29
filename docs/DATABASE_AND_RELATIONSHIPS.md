# Database Schema & Entity Relationships

This document explains how data is structured in Perfin and how different entities interact. Understanding these relationships is critical to maintaining data integrity.

## Core Entities

### 1. Households & Members
- **Relation:** One `household` has many `householdMembers`.
- **Ownership:** Every data point (Transactions, Accounts, Budgets) belongs to either a `userId` (Personal) or a `householdId` (Shared).
- **Rule:** Always use the `by_householdId` index when fetching shared data to ensure privacy and security.
- **Timezone Fields:**
    - `timezone`: IANA timezone string (e.g. `"Asia/Jakarta"`). Used by backend to compute fiscal periods in the user's local time.
    - `timezoneMode`: `"manual"` or `"device"`. Determines whether timezone is user-selected or auto-detected from the browser.
    - Default: `timezone: "Asia/Jakarta"`, `timezoneMode: "device"` for new households.

### 2. Accounts & Categories (Atomic Mirroring)
This is a unique architectural pattern in Perfin.
- **Linked Goal:** Every `SAVING` or `ASSET` account is linked to a specific `category` (type: `saving`).
- **Sync Logic:** 
    - Renaming an account renames the category.
    - Archiving an account archives the category.
    - Total Balance of the account MUST reflect the accumulated net transfers to that category.
- **Reference:** Stored in `accounts.linkedCategoryId`.

### 3. Transactions (The Ledger)
The `transactions` table is the source of truth for all balances.
- **Types:** `expense`, `income`, `transfer`.
- **Split Logic:** A single transaction can have many `splits`. Each split has its own `categoryId` and `amount`.
- **Search Optimization:** Uses `searchCategoryIds` and `searchLabelIds` (arrays) to index both the main category and all split categories for fast filtering.

### 4. Merchants (Payee Tracking)
The `merchants` table tracks spending patterns by payee/merchant.
- **Scope:** Household-only (shared between members, not personal).
- **Fields:** `name`, `icon` (emoji, letter avatar, or Iconify brand icon URL), `householdId`, `userId`.
- **Indexes:** `by_householdId`, `by_userId`, `by_householdId_name`.
- **Relationship:** Transactions reference `merchantId` (optional) via `v.id("merchants")`.
- **Index on Transactions:** `by_merchantId` index for efficient lookups in queries and delete guards.
- **Icon Types:**
  - **Emoji:** Native emoji character (e.g., ☕, 🛒).
  - **Letter Avatar:** First letter of merchant name, rendered as colored circle.
  - **Brand Icon:** Full Iconify SVG URL (e.g., `https://api.iconify.design/simple-icons/starbucks.svg`).
- **Delete Guard:** Cannot delete a merchant that is referenced by any transaction.

## Advanced Relationships

### 4. Receivables (Parent-Child Transactions)
To support partial settlements (installments), we use a self-referential relationship in the `transactions` table.

- **Parent (The Debt):**
    - `isReimbursable: true`
    - `reimbursementStatus: 'pending' | 'settled' | 'forgiven'`
    - `amountPaid`: Denormalized field tracking the sum of all settlements.
    - `settlementStatus: 'unpaid' | 'partial' | 'settled'`
- **Child (The Settlement):**
    - `type: 'income'`
    - `parentTransactionId`: Points to the Parent's `_id`.
    - **Rule:** The `categoryId` of the child MUST match the `categoryId` of the parent to trigger the **Netting Logic**.

### 5. Budgets & Fiscal Periods
- **Relation:** A `budget` document exists for a unique combination of `categoryId`, `year`, and `month`.
- **Month Indexing:** `month` field is **0-indexed** (0=January, 11=December). `getFiscalDateDetails` always returns 0-indexed months.
- **Fiscal Start Day:** All monthly groupings are calculated using `budgetStartDay` from the household settings. 
    - *Example:* If Start Day is 25, a transaction on Jan 26 belongs to the "February" budget period.
- **Timezone:** Fiscal period transitions happen at midnight in the user's configured timezone (not UTC). Backend uses `getServerNow(timezone)` to compute the current period.
- **Budget Fields:**
    - `amount`: Current budget allocation for the period.
    - `initialAmount`: Original allocation from "Set Limit" action. Updated when user changes budget via "Set Limit".
    - `totalAdjustments`: Accumulated changes from "Move Funds" mutation (can be negative). Stored for audit trail.
    - `carryoverAmount`: Debt (negative) or surplus (positive) carried from previous month (paced budgets only).
    - `sweptAmount`: Unspent funds returned to wallet at month-end (non-pacing budgets only).
- **Budget Formula (effective limit):**
    ```
    Effective Limit = amount + carryoverAmount
    Remaining = Effective Limit - sweptAmount - spent
    ```
- **Allowance Configuration (Categories):**
    - `allowanceType`: `"budget_period"` (daily pacing across the entire fiscal period) or `"weekly"` (weekly spending limit).
    - `weeklyResetDay`: 0=Sunday, 1=Monday, ..., 6=Saturday. Only used when `allowanceType === "weekly"`.
    - **Allowance is a recommendation layer only** — it never affects budget allocation, remaining budget, or month-end processing.
    - `enablePacing` is independent — it controls the pace indicator (safe/warning/danger).
    - Computed via `AllowanceCalculator` (`lib/allowance-calculator.ts`), a pure TypeScript module with no Convex/React dependencies.

#### Allowance Calculation Details

The `AllowanceCalculator` (`lib/allowance-calculator.ts`) provides two pacing strategies:

**1. Budget Period (Daily) — `allowanceType: "budget_period"`**
- Evenly divides the remaining budget across all remaining days in the fiscal period.
- Formula: `allowance = remaining / daysRemaining`
- Returns: `allowance` (daily rate), `remaining`, `daysRemaining`
- Use case: Standard daily spending guidance.

**2. Weekly — `allowanceType: "weekly"`**
- Allocates a proportional weekly share based on the current week's size, then deducts spending within that week.
- Formula:
  1. `dailyAllowance = remaining / daysRemaining` (budget-period daily rate)
  2. `weeklyAllowance = dailyAllowance × segment.days` (proportional weekly share)
  3. `weeklyRemaining = max(0, weeklyAllowance - weeklySpent)` (what's left this week)
  4. `allowance = weeklyRemaining / daysRemainingInWeek` (daily rate within current week)
- Returns: `allowance` (daily rate within week), `weeklyRemaining` (actual weekly amount), `weekStart`, `weekEnd`, `weekNumber`, `daysRemainingInWeek`
- Use case: Users who prefer weekly spending limits with a configurable reset day.

**Days Remaining Calculation:**
- Both `daysRemaining` (fiscal period), `daysRemainingInWeek`, and `segment.days` (week segment length) use `Math.floor(diffMs / msPerDay) + 1` to count calendar days inclusively (including today).
- `Math.floor` is used instead of `Math.round` to avoid off-by-one errors — `Math.round` would round up partial days (e.g., 0.589 days → 1) and then `+1` would double-count, yielding 2 instead of 1 when today is the last day. The same issue applied to `segment.days` where boundaries are `00:00:00` to `23:59:59.999`, producing `N - 0.000...001` days for N calendar days.
- `+1` makes the count inclusive: if `now` and `end` are the same calendar day, result is 1.
- **`now` must be normalized to start-of-day (00:00:00) before the calculation.** Reason: `getFiscalMonthRange` returns `end` at midnight (`new Date(year, month, day)`), while `now` can be any time. Without normalization, `diffMs` would be less than full days (e.g., 25.5 days at noon), causing `Math.floor` to drop the partial day and produce 26 instead of 27 remaining days. The `AllowanceCalculator` normalizes via `nowStart.setHours(0, 0, 0, 0)`. Other engines (`calculateFiscalDaysRemaining`, `calculateBudgetPace`) rely on `date-fns`'s `differenceInCalendarDays` which strips time internally.

**Important: Display Rules**
- `allowance.allowance` is **always a daily rate** — even for weekly type (it's `weeklyRemaining / daysRemainingInWeek`).
- When displaying "for this week" / "/week", use `allowance.weeklyRemaining` (the actual weekly remaining amount).
- When displaying "for today" / "/day", use `allowance.allowance` (the daily rate).
- `MobileHeroSummary` always shows aggregated daily allowance (correct behavior).
- `BudgetCard` and `MobileBudgetToday` must check `allowance.type` to decide which value to display.
- **Set Limit Action:**
    - When user edits budget (via BudgetDrawer or QuickAdjust), both `amount` and `initialAmount` are set to the new value.
    - `totalAdjustments` remains unchanged.
- **Move Funds (Standalone Drawer):**
    - `moveBudgetFunds` mutation powers `components/MoveFundsDrawer.tsx`, accessible via "Move Funds" button in the Allocation Progress Hero Card on the budget page.
    - Supports transfers from Unassigned Cash or other category budgets to any category (or back to Unassigned).
    - `toCategoryId` is optional — `undefined` returns funds to Unassigned Cash.
    - Source budget: `amount -= moveAmount` (carryoverAmount NOT modified to avoid `getMonthEndProposals` invariant break).
    - Destination budget: `amount += moveAmount`, `totalAdjustments += moveAmount`.
    - Self-transfer guarded: `fromCategoryId === toCategoryId` throws error.
- **Month-End Processing:**
    - Proposals are derived client-side from `budgetData.data` via `useMemo` in the month-end page — no separate server call.
    - **Formula for Remaining Funds:** `max(0, (Allocated + Carryover) - NetSpent)` where `NetSpent = Expenses - Income` (settlements count as negative spending).
    - **Standard Categories:** Positive remaining funds are **Swept**.
    - **Paced Categories:** Surplus and Debt are **Rolled Over** via `carryoverAmount`.
    - **Atomic Processing:** `processMonthEnd` mutation combines sweep + rollover in a single Convex transaction. Saves a snapshot before processing for rollback capability.
- **Swept/Carryover Fields:** 
    - `sweptAmount`: Funds already returned to the wallet (prevents double-counting).
    - `carryoverAmount`: Debt or surplus carried forward (Paced budgets only).

## Integrity Triggers (Backend Logic)

| Action | Impact |
| :--- | :--- |
| **Delete Parent Debt** | **Cascade Delete:** Automatically deletes all related settlement transactions. |
| **Delete Settlement** | **Reverse Update:** Subtracts the amount from the Parent's `amountPaid` and reopens the debt status. |
| **Create Asset Buy** | **Inventory Update:** Increases `quantity` and `totalCostBasis` on the Asset Account. |
| **Create Asset Sell** | **Profit Calculation:** Decreases `quantity` and calculates `totalRealizedProfit` based on average cost. |

## Query Guidelines
- **NEVER** calculate `spent` amounts manually in a query. Use `calculateSpendingByCategory` from `convex/lib/finance.ts`.
- **NEVER** ignore the `categoriesMap` when analyzing flows, or settlements will be misclassified as regular income.
- **Merchant Filtering:** Use `merchantId` parameter (array of IDs) in `transactions.get`, `transactions.searchTransactions`, and `transactions.exportTransactions` queries. Filtered server-side via `.filter()` for performance.

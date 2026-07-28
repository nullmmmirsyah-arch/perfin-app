# Product Overview: Perfin App

**Perfin** is a modern, mobile-first Personal Finance Tracker designed for individuals and households. It emphasizes real-time synchronization, zero-based budgeting principles, and actionable goal tracking.

## Core Features

### 1. Transactions Management
- **Types:** Expense, Income, Transfer.
- **Asset Transactions (Buy/Sell):** Handled as Transfers between Liquid and Asset accounts. Backend automatically calculates:
    - **Buy:** Decreases Cash, Increases Asset Quantity/Cost Basis.
    - **Sell:** Increases Cash, Decreases Asset Quantity/Cost Basis, calculates Realized Profit.
- **Split Transactions:** Ability to split a single transaction into multiple categories.
    - **Unified UI:** Accessed directly through the **Category Selector**. Selecting "Split Transaction" activates the dedicated drawer.
    - **Context-Aware Fields:** When Split mode is active, global fields (Category, Label, Description) are hidden to prevent redundancy, replaced by a "Split Summary Card" that shows item count and total allocated funds.
- **Filtering:** Powerful **Multi-Select Filtering** allows users to combine multiple Accounts, Categories, Types, and Merchants simultaneously. All filters are consolidated inside a single filter popover, including **Date Range**.

#### Transaction Input Flow

**Entry Points:**
- **Mobile:** Floating Action Button (FAB) "+" on Transactions page and Dashboard.
- **Desktop:** FAB "+" (tablet), Sidebar link, or "Add Transaction" button.
- **Edit Mode:** Tap transaction item → "Edit" action → opens the same drawer pre-filled.

**Container:**
- **Mobile:** `Drawer` (vaul) — slides up from bottom, max height 96dvh.
- **Desktop:** `Sheet` (Radix) — slides in from right, max width 500px.
- Both use the same `TransactionDrawer` component with platform-specific rendering.

**Flow — Expense / Income:**

| Step | Field | Mobile | Desktop | Required | Notes |
|------|-------|--------|---------|----------|-------|
| 1 | **Type Tab** | Segmented control (Expense / Income / Transfer) | Tabs row | Yes | Default: Expense. Color-coded: red (expense), green (income), blue (transfer). |
| 2 | **Amount** | Tap to open `MobileAmountInput` numpad (bottom sheet) | Direct numeric `Input` | Yes | Auto-focused on open. Shows "Insufficient Balance" warning if amount > account balance. |
| 3 | **Merchant** | `MobileInputCard` → `MerchantCombobox` | `MerchantCombobox` (inline) | No | Searchable. Inline "Create [name]" option — no separate drawer for quick create. |
| 4 | **Account** | `MobileSelectionDrawer` (card tap) | `Select` dropdown | Yes | Shows account balance. Private accounts hide balance from other household members. |
| 5 | **Category** | `MobileSelectionDrawer` (card tap) | `Select` dropdown | Yes | Expense categories show `Available: Rp X` (remaining budget). Contains "🔀 Split Transaction" action item at top. |
| 5a | → *Split mode* | Opens nested `SplitEditorDrawer` | Opens nested `SplitEditorDrawer` | — | See *Split Transaction Flow* below. |
| 6 | **Date** | `MobileDatePicker` | `DatePicker` (with year/month nav) | Yes | Default: today. Disabled: future dates. Normalized to 12:00 PM on submit. |
| 7 | **Labels** | `LabelCombobox` (grid popover) | `LabelCombobox` (grid popover) | No | Multi-select. Optional tagging for cross-category tracking. |
| 8 | **Description** | `Textarea` card | `Input` | No | Free-text note. |
| 9 | **Reimbursement** | `Switch` toggle card | `Switch` toggle | No | "To be reimbursed?" — if enabled, shows "Owed By" text input + status badge. |

**Flow — Transfer:**

| Step | Field | Mobile | Desktop | Required | Notes |
|------|-------|--------|---------|----------|-------|
| 1 | **Type Tab** | Select "Transfer" tab | Select "Transfer" tab | Yes | — |
| 2 | **Amount** | `MobileAmountInput` numpad | Direct numeric `Input` | Yes | Label changes: "Total Cost" (buy asset) or "Total Sale Value" (sell asset). |
| 3 | **From Account** | `MobileSelectionDrawer` | `Select` dropdown | Yes | Shows balance. |
| 4 | **To Account** | `MobileSelectionDrawer` | `Select` dropdown | Yes | Must differ from From Account. |
| 5 | **Category** | `MobileSelectionDrawer` | `Select` dropdown | Conditional | Required if either account is Saving/Asset (Special). Auto-selected if destination has `linkedCategoryId`. |
| 6 | **Quantity/Weight** | Numeric `Input` card | `Input` | Conditional | Required if either account is Asset type. Shows implied unit price. |
| 7 | **Date** | `MobileDatePicker` | `DatePicker` | Yes | Same as Expense. |
| 8 | **Labels** | `LabelCombobox` | `LabelCombobox` | No | — |
| 9 | **Description** | `Textarea` card | `Input` | No | — |

**Split Transaction Flow:**
1. User selects "🔀 Split Transaction" from Category selector.
2. Parent form hides: Category selector, Label, Description — replaced by **Split Summary Card** (item count + total allocated).
3. `SplitEditorDrawer` (nested drawer) opens with:
   - Per-item rows: Category selector + Amount input + optional Description + optional Labels.
   - "Add Item" button to append rows.
   - Swipe-to-delete on mobile for each row.
4. Validation: total of all split amounts must equal the transaction amount.
5. Close sub-drawer → parent form re-validates splits → shows error badge if mismatch.
6. "Revert to Single Category" link to exit split mode.

**Submit & Safety:**
- **Double-Click Prevention:** `useRef` lock + `isProcessing` state — button disabled during save.
- **Haptic Feedback:** `navigator.vibrate(10)` on submit (mobile).
- **Date Normalization:** Selected date is set to 12:00 PM local time before sending to backend to prevent UTC timezone shifts.
- **Backend:** Calls `api.transactions.create` (or `api.transactions.update` in edit mode). Mutations trigger `recomputeUserCache` for real-time dashboard sync.
- **Success:** Toast notification + drawer closes.

**Navigation Safety (Dirty State):**
- Back button / backdrop click / Cancel with unsaved changes → `AlertDialog` ("Discard changes?").
- "Keep Editing" → dismisses dialog, locks close attempts for 500ms.
- "Discard" → resets form and closes drawer.
- Split sub-drawer has its own history stack — back button closes split drawer first, then main drawer.

### 2. Accounts (Funds Storage)
- **Types:**
  - **Liquid (Cash/Bank):** Used for daily spending.
  - **Savings:** Non-liquid funds reserved for specific goals.
  - **Assets:** Track value of non-monetary items (Gold, Stocks) with Quantity/Unit support.
- **Asset Onboarding:** When creating a new Asset account, providing an **Initial Balance** and **Initial Quantity** automatically initializes the `totalCostBasis`. This ensures that future sales of pre-owned assets provide accurate Profit/Loss reports.
- **Linked Goals:** Creating a **Saving** or **Asset** account automatically creates a linked category (Goal) with the same name.
- **Unified Management:**
  - **Full Control:** Goal targets (amount/date), **Monthly Contribution (Budget)**, and **Auto-Save** schedules can be managed directly from *either* the Account Drawer or the Category Drawer.
  - **Synchronization:** Changes made in one view (e.g., enabling Auto-Save in Account settings) are immediately reflected in the other (Category settings).
- **Lifecycle:** Supports **Archiving/Closing** accounts.
  - *Rule:* Accounts can only be closed if Balance is 0. Closing an account automatically archives its linked goal.
- **Separation:** UI separates Liquid Assets vs Long-term Assets.

### 3. Categories & Goals
- **Types:** Expense, Income, Saving (Goal).
- **Goal Creation Wizard:** A 4-step drawer-based wizard for creating goals:
    - **Step 1 - Goal Type:** Visual cards for Investment (Wealth), Bill (Sinking Fund), or Purchase (Wishlist). Auto-advances on selection.
    - **Step 2 - Name & Target:** Goal name and target amount with currency formatting.
    - **Step 3 - Timeline & Contribution:** Optional target date and monthly contribution. Live calculator shows projected completion date and suggests contribution amounts.
    - **Step 4 - Review:** Summary card with all details before creation.
    - **Celebration:** Confetti animation and success sound on creation. Auto-closes after 2 seconds.
    - **Edit Mode:** Same wizard supports editing existing goals with pre-filled data.
    - **Unsaved Changes:** Dirty-state tracking with discard confirmation dialog.
- **Smart Goals Structure:**
  - **🛡️ Wealth (Investment):** Long-term accumulation (e.g., Emergency Fund, Gold, Stocks).
    - *Achievement Flow:** Increase Target (Growth).
  - **📅 Bill (Sinking Fund):** Recurring obligations (e.g., Annual Tax, Insurance).
    - *Achievement Flow:** Pay & Reset Cycle. Uses **Cycle Tracking** to reset the target period. Any **surplus funds** remaining after payment are automatically carried over (rolled over) to jumpstart the next cycle's progress.
  - **✨ Goal (Purchase/Wishlist):** One-off purchases (e.g., Vacation, Gadget).
    - *Achievement Flow:** Spend & Archive.
- **Account-Goal Mirroring (Atomic):**
  - Creating a **Saving/Asset Account** automatically creates a linked **Goal**.
  - Creating a **Goal** automatically creates a linked **Account**.
  - Renaming or Deleting one entity automatically syncs the other.
- **Goal Logic:**
  - **Accumulation:** Calculated dynamically based on net transfers into the account/category.
  - **Cycle Tracking:** For Bills, accumulation is calculated only for transactions *after* the last reset date.
  - **History:** Completed cycles are stored in `goalHistory` for audit trails.
  - **Fund Management:**
  - **Add Funds (Deposit):** Dedicated wizard to transfer money from a Liquid Account (Wallet) to a Goal/Asset. For Assets, it prompts for quantity bought.
  - **Withdraw Funds:** Wizard to transfer money back to Liquid.
    - **Smart Disbursement:** Includes a toggle to flag withdrawal as "Spending the Goal" (Disbursement). This prevents the withdrawal from being counted as negative spending (reversal), preserving your saving history while freeing up the cash.
  - **⚡ Auto-Save (Scheduled Transfers):**
    - **Concept:** "Set and Forget" funding for goals. Users can enable automatic monthly transfers from a Liquid Account to a Goal.
    - **Goal-Centric Control:** Managed directly within the Goal Creation wizard or the Goal Detail page (via a dedicated status card).
    - **Safety Mechanisms:** System checks for sufficient funds in the source account before execution. If funds are insufficient, the run is skipped, flagged as "Failed", and the user is notified via **System Notification**.
    - **Lifecycle:** Archiving or Deleting a goal automatically pauses or removes the associated schedule.

### 4. Labels (Tagging)- **Purpose:** flexible tagging system for transactions, independent of Categories.
- **Usage:** Useful for tracking specific events (e.g., "Holiday 2024", "Reimbursable") across different categories.
- **Visuals:** Labels have names and custom colors.
- **Splits:** Can be applied to individual splits within a split transaction.

### 5. Merchant & Payee Tracking
- **Purpose:** Track spending patterns by merchant/payee for better financial insights.
- **Scope:** Household-only (shared between members).
- **Icon System:** 3 icon types supported:
  - **Emoji:** Native emoji character (e.g., ☕, 🛒).
  - **Letter Avatar:** First letter of merchant name, rendered as colored circle (auto-created).
  - **Brand Icon:** Iconify brand logos (e.g., Starbucks, Amazon) via API search.
- **Quick Entry:** Searchable `MerchantCombobox` in transaction form with inline "Create [name]" option.
  - Creating a merchant auto-uses first letter as icon (no drawer opens).
  - Icon can be customized later via the merchant drawer.
- **Transaction Integration:** Merchant field positioned after Amount, before Account in transaction forms.
- **Merchant Management:** Dedicated `/merchants` page with:
  - Search and filter merchants.
  - Create, edit, and delete merchants.
  - Delete guard: Cannot delete merchants referenced by transactions.
- **Visual Display:** Transaction items and merchant pages render all 3 icon types correctly.

### 5. Budgeting (Zero-Based Budgeting)
- **Monthly Budgets:** Set limits per category per month.
- **Swipeable Views:** Separate sections for "Monthly Expenses" and "Savings & Goals" navigable via swipe.
- **Allocation Progress Hero Card:** Komponen prominent di atas budget page yang menunjukkan berapa % income sudah di-assign. Progress bar besar dengan percentage, stats row (Income/Budgeted/Unassigned), contextual nudge messages, dan confetti celebration saat mencapai 100%. Tombol "Move Funds" langsung di card jika masih ada unassigned cash.
- **Move Money (Rule 3):**
    - Users can easily move funds from **Unassigned Cash** or **Other Categories** to cover overspending or assign funds.
    - **Smart Drawer:** Budget drawer features "Set Limit" with quick-adjust preset buttons and real-time preview of remaining balance. **Move Funds** has its own dedicated drawer accessible via the "Move Funds" button in the Allocation Progress Card, supporting transfers between categories and Unassigned Cash with real-time preview of remaining budgets.
- **Real-time Tracking:** Visual progress bars synced with Dashboard.
    - **Expense Budget:** Tracks `Spent / Limit` with days remaining and daily burn rate.
    - **Savings/Goals Budget:** Tracks `Monthly Contribution / Monthly Target`. Shows a **"Monthly Goal Met"** celebration badge when the monthly saving target is reached.
- **Zero-Based Logic:** Tracks **Unassigned Cash** (Total Income - Total Budgeted).
    - **Visual Motivation:** Allocation Progress Card menggunakan Goal Gradient Effect dan Completion Bias untuk mendorong user mencapai 0 unassigned.
    - **Settlement Integrity:** Income categorized into an expense category (reimbursements/settlements) acts as **Negative Spending**, accurately increasing the available budget for that category.
    - **Strict Rule:** Ideally, Unassigned Cash should be 0.
    - **Flexible Overspending:** Overspending in a category results in a **Negative Available** balance. 
- **Month-End Processing (Month-End Review):**
    - **Concept:** A unified action to finalize the previous month's budget and start the new month with accurate balances.
    - **Accurate Settlement Handling:** Corrects for reimbursements by using **Net Spending** in the surplus calculation.
    - **Non-Destructive Sweep:** For standard budgets, unspent funds are "swept" back to **Unassigned Cash** for the current month. The historical budget limit remains unchanged.
    - **Smart Rollover (Carryover):** For categories with **Smart Budget (Pacing)** enabled, any remaining balance (positive or negative) is **automatically carried over** to the current month.
        - *Positive Carryover (Surplus):* Increases available budget.
        - *Negative Carryover (Debt):* Carried forward as a budget deficit that must be covered.
- **Smart Budget Pace (New):**
    - **Concept:** Proactive warning system for variable expenses.
    - **Logic:** Compares "Time Passed %" vs "Budget Used %".
    - **Indicators:**
        - 🟢 **Safe:** Spending is slower than time.
        - 🟡 **Warning:** Spending pace is matching time (+10% tolerance).
        - 🔴 **Danger:** Spending is significantly faster than time.
    - **Opt-In:** Users can enable/disable this per category.
- **Budget Allowance:**
    - **Concept:** Per-category spending recommendation that works alongside the budget, not as part of it. Pure recommendation layer — never affects budget allocation, remaining budget, or month-end processing.
    - **Types:**
        - **Budget Period (Daily):** Evenly divides the budget across the fiscal period. Shows daily allowance and days remaining.
        - **Weekly:** Fixed weekly spending limit with configurable reset day (Sun-Sat). Shows weekly allowance with week date range.
    - **Home Screen:** Tabs removed. Each category card shows allowance amount as primary ("Rp X for today" / "Rp X for this week") with days remaining or week range on the right.
    - **BudgetCard:** Remaining is primary, allowance is secondary.
    - **Configuration:** Via BudgetDrawer — RadioGroup for type selection, conditional Select for weekly reset day.
    - **Category Detail:** Shows daily/weekly breakdown with spending pace relative to allowance.

    **User Flow — Configuring Allowance Type:**
    1. User opens **BudgetDrawer** (via "Set Limit" on Budget page or category action).
    2. After selecting a category and entering monthly allocation, the **Allowance** section appears.
    3. User chooses between two options via **RadioGroup**:
        - **Budget Period** (default) — Recommended spending is spread evenly across the remaining budget period.
        - **Weekly** — Allowance resets every week on a chosen day.
    4. If **Weekly** is selected, a **Reset Every** dropdown appears (Sunday–Saturday, default: Monday).
    5. User saves — `upsertBudget` mutation saves the budget amount, then `updateAllowanceConfig` mutation saves the allowance type and reset day to the category.
    6. **Display behavior changes immediately:**
        - Budget Period: Home shows "{amount} for today" with "{days}d left".
        - Weekly: Home shows "{amount} for this week" with "{start} - {end}" date range.

### 6. Households & Collaboration
- **Multi-User:** Support for shared financial tracking (e.g., couples, families).
- **Roles:**
  - **Admin:** Can manage members and settings.
  - **Member:** Can view and add transactions.
- **Invites:** Invite system via email/code with expiration.
- **Context Switching:** Users can switch between "Personal" view and "Household" view. Data is siloed by `householdId`.

### 7. Privacy Mode
- **Purpose:** Protect sensitive financial data when using the app in public spaces.
- **Default Behavior:** Privacy Mode defaults to **ON (Active)** every time the application is loaded or the user navigates back to the Dashboard. It does not persist the "OFF" state across sessions/navigation to ensure security.
- **Visuals:** Sensitive amounts (Balances, Totals) are masked using bullet characters (`••••`) instead of asterisks.
- **Interaction:** Toggled via the **Eye Icon** in the Dashboard Page Header.

### 8. Custom Budget Cycle (Fiscal Month)
- **Concept:** Supports users who receive income on a specific date (e.g., 25th) rather than the 1st of the month.
- **Configuration:** Managed in Household Settings (`budgetStartDay`).
- **Logic:**
    - If Start Day = 25.
    - Transaction on Jan 20th -> Belongs to **December Fiscal Period** (Dec 25 - Jan 24).
    - Transaction on Jan 26th -> Belongs to **January Fiscal Period** (Jan 25 - Feb 24).
- **Impact:** All dashboards, budgets, and reports automatically align with this cycle. "Safe to Spend" calculates days remaining until the *next cycle start*, not the end of the calendar month.

### 9. Funds Reconciliation (Virtual Allocations)
- **Problem:** Users often keep savings in their main bank account but track them as separate "Goals" in the app. This causes a mismatch between App Balance (deducted) and Real Bank Balance (full).
- **Solution:** Liquid Accounts (Cash/Bank) now feature a **Reconciliation Trace**.
- **Visuals:** In Account Details and Dashboard:
    - **Total Bank Balance:** The real-world balance (Available + Allocated).
    - **Allocated Funds:** Breakdown of money reserved for specific Goals/Savings.
    - **True Available:** The amount safe to spend.

### 10. Category Insights & Analytics
- **Category Detail Page:** A dedicated view for deep-diving into a specific category's performance.
- **Features:**
    - **Performance Trend:** A 12-month bar chart visualizing **Effective Budget** (Planned + Adjustments) vs. Actual Spending. It correctly reflects historical budgets even after funds have been swept.
    - **Effective Budget Logic:** Pacing indicators and color schemes are calculated against the total effective capacity (Planned + Rollover), ensuring 100% consistency with the Dashboard and Budget cards.
    - **Transparent Breakdown:** Interactive tooltips reveal the exact composition of the monthly budget (e.g., "Planned + Rollover") for full historical clarity.
    - **Monthly History:** A detailed list showing Budget, Spent, Carryover, and Swept amounts for each fiscal month.
    - **Grouped & Actionable Transactions:** A detailed list of recent transactions grouped by date with **daily net flow totals**. Includes full support for editing and deleting transactions.
    - **Contextual Data:** For split transactions, the list intelligently displays only the description and amount relevant to the current category.
    - **Interactive Filtering:** Features powerful filters for **Date Range** and **Accounts**. By default, the page filters transactions for the **Current Fiscal Period**.
    - **Fiscal Awareness:** All data points, including charts and history lists, automatically align with the user's custom `budgetStartDay`.

### 11. Export Transactions
- **Format:** CSV (Comma Separated Values).
- **Scope:** Respects current active filters (Date Range, Type, Account, Category, Label, Merchant).
- **Split Handling:** Uses **"Exploded Rows"** logic.
    - A split transaction is not exported as a single summarized row.
    - Instead, it is broken down into multiple rows, each representing a specific split item with its own category and amount.
    - This ensures pivot tables and analysis in Excel/Google Sheets are accurate and granular.
- **Access:** Available via the "Export" button on the Transactions page header.

### 12. Dashboard Enhancements
- **Interactive Navigation:**
    - **Wealth Card:** Users can click on individual goal items to navigate directly to that goal's detail page.
    - **Daily Operations Card:** Users can click on individual budget rows to navigate directly to the category's detail page for performance analysis and history.
    - **Visual Cues:** Both cards use consistent hover effects and chevron icons to indicate interactivity.
- **Quick Access:** A "View All" link in the card headers provides a shortcut to the main Goals or Transactions lists.

### 13. Receivables & Debt Tracking (Lent)
- **Concept:** Track money lent to others (friends, office reimbursements) without losing sight of personal budget integrity.
- **Workflow:**
    - **Mark as Reimbursable:** Expenses can be flagged as "To be reimbursed" with the name of the debtor.
    - **Dashboard Tracking:** Active debts appear in the "Lent" tab of the Daily Operations card.
    - **Partial Settlements:** Supports installments. Each payment is linked to the original debt.
    - **Netting Logic:** Settlement (Income) to an Expense category acts as "Negative Spending", restoring the original budget limit.
    - **Forgiveness:** Debts can be "Forgiven", converting them into permanent personal expenses and removing them from the tracking list.

### 14. Navigation Safety (Logout Confirmation)
- **Concept:** Prevents accidental app exit and ensures session security.
- **Trigger:** When a user attempts to go "Back" from the first page of the application (potentially leaving the domain to an external site or empty tab).
- **Behavior:** Intercepts the navigation and displays a confirmation dialog.
- **Options:** 
    - **Stay:** Returns the user to the application.
    - **Logout:** Explicitly signs the user out via Clerk and redirects to the Hero/Landing Page.

## Business Rules & Integrity
1.  **Deletion vs Archiving:** Prefer Archiving for Accounts and Categories to preserve historical transaction data. Hard delete is blocked if transactions exist.
2.  **Account Type Locking:** Once an account has associated transactions, its **Type (Cash/Asset/Saving)** is permanently locked. This prevents data corruption (e.g., swapping Cash to Asset without quantity data) and historical report inconsistencies. Users must Archive the old account and create a new one if a type change is needed.
3.  **Asset Inventory Safety:**
    - The system strictly enforces **Non-Negative Quantity** for assets.
    - Actions that would result in negative inventory (e.g., Deleting a "Buy" transaction after the asset has been sold, or Editing a "Sell" transaction to sell more than currently owned) are blocked with a descriptive error.
4.  **Transfers:**
    - Transfer between Liquid accounts = Neutral.
    - Transfer Liquid -> Saving/Asset = "Spending" (allocating to goal).
    - **Auto-Categorization:** Transfers to accounts with linked categories automatically inherit that category.
    - Transfer Saving -> Liquid = "Income" (releasing funds).
    - **Smart Disbursement:** If a transfer is detected from Special (Saving) -> Liquid (Cash), it is automatically flagged as **Disbursement**. It increases Unassigned Cash but does **NOT** count as negative spending (to preserve historical accumulated stats) and does **NOT** auto-inflate the budget.
    - **Buyback/Sell Asset:** Treated as Income (Capital + Profit) to Unassigned Cash (if recorded as split) or Net Reversal of Spending.
5.  **Receivables Integrity:**
    - **Cascading Deletes:** Deleting a debt transaction automatically deletes all its settlement history to maintain balance.
    - **Automatic Reversal:** Deleting a settlement transaction automatically reopens the debt and reduces the "Amount Paid" on the parent.
    - **Anti-Overpay:** The system blocks payments that exceed the remaining debt balance.

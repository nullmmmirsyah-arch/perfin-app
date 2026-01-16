# Product Overview: Perfin App

**Perfin** is a modern, mobile-first Personal Finance Tracker designed for individuals and households. It emphasizes real-time synchronization, zero-based budgeting principles, and actionable goal tracking.

## Core Features

### 1. Transactions Management
- **Types:** Expense, Income, Transfer.
- **Asset Transactions (Buy/Sell):** Handled as Transfers between Liquid and Asset accounts. Backend automatically calculates:
    - **Buy:** Decreases Cash, Increases Asset Quantity/Cost Basis.
    - **Sell:** Increases Cash, Decreases Asset Quantity/Cost Basis, calculates Realized Profit.
- **Split Transactions:** Ability to split a single transaction into multiple categories. Uses a dedicated **Nested Drawer** UI for better mobile experience.
- **Filtering:** Powerful **Multi-Select Filtering** allows users to combine multiple Accounts, Categories, or Types simultaneously. Supports Date Range filtering.
- **Analytics:** Integrated visual analytics (Donut Chart) with **Real-time Trend Analysis** (comparing current vs previous period) directly within the transaction list via a swipeable tab interface.

### 2. Accounts (Funds Storage)
- **Types:**
  - **Liquid (Cash/Bank):** Used for daily spending.
  - **Savings:** Non-liquid funds reserved for specific goals.
  - **Assets:** Track value of non-monetary items (Gold, Stocks) with Quantity/Unit support.
- **Linked Goals:** Creating a **Saving** or **Asset** account automatically creates a linked category (Goal) with the same name.
- **Unified Management:** Goal targets (amount and date) are managed directly within the Account management UI.
- **Lifecycle:** Supports **Archiving/Closing** accounts.
  - *Rule:* Accounts can only be closed if Balance is 0. Closing an account automatically archives its linked goal.
- **Separation:** UI separates Liquid Assets vs Long-term Assets.

### 3. Categories & Goals
- **Types:** Expense, Income, Saving (Goal).
- **Smart Goals Structure:**
  - **🛡️ Wealth (Investment):** Long-term accumulation (e.g., Emergency Fund, Gold, Stocks).
    - *Achievement Flow:* Increase Target (Growth).
  - **📅 Bill (Sinking Fund):** Recurring obligations (e.g., Annual Tax, Insurance).
    - *Achievement Flow:* Pay & Reset Cycle. Uses **Cycle Tracking** to reset the target period. Any **surplus funds** remaining after payment are automatically carried over (rolled over) to jumpstart the next cycle's progress.
  - **✨ Goal (Purchase/Wishlist):** One-off purchases (e.g., Vacation, Gadget).
    - *Achievement Flow:* Spend & Archive.
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
    - **Safety Mechanisms:** System checks for sufficient funds in the source account before execution. If funds are insufficient, the run is skipped, flagged as "Failed", and the user is notified.
    - **Lifecycle:** Archiving or Deleting a goal automatically pauses or removes the associated schedule.

### 4. Labels (Tagging)- **Purpose:** flexible tagging system for transactions, independent of Categories.
- **Usage:** Useful for tracking specific events (e.g., "Holiday 2024", "Reimbursable") across different categories.
- **Visuals:** Labels have names and custom colors.
- **Splits:** Can be applied to individual splits within a split transaction.

### 5. Budgeting (Zero-Based Budgeting)
- **Monthly Budgets:** Set limits per category per month.
- **Swipeable Views:** Separate sections for "Monthly Expenses" and "Savings & Goals" navigable via swipe.
- **Move Money (Rule 3):**
    - Users can easily move funds from **Unassigned Cash** or **Other Categories** to cover overspending or assign funds.
    - **Smart Drawer:** Budget drawer now features tabs for "Set Limit" and "Move Funds" with real-time preview.
- **Real-time Tracking:** Visual progress bars synced with Dashboard.
    - **Expense Budget:** Tracks `Spent / Limit`.
    - **Savings/Goals Budget:** Tracks `Monthly Contribution / Monthly Target`. Shows a **"Monthly Goal Met"** celebration badge when the monthly saving target is reached.
- **Zero-Based Logic:** Tracks **Unassigned Cash** (Total Income - Total Budgeted).
    - **Strict Rule:** Ideally, Unassigned Cash should be 0.
    - **Flexible Overspending:** Overspending in a category results in a **Negative Available** balance for that category. It does **NOT** automatically deduct from Unassigned Cash. This preserves the user's original allocation plan ("Envelope Budgeting") while highlighting the deficit that needs to be covered.
    - **Smart Auto-Budgeting:** If a transaction is made to a category without a budget, the system automatically creates a budget with the **transaction amount**. *Exception: Goal Disbursement transactions do NOT trigger auto-budgeting.*
- **Smart Budget Pace (New):**
    - **Concept:** Proactive warning system for variable expenses.
    - **Logic:** Compares "Time Passed %" vs "Budget Used %".
    - **Indicators:**
        - 🟢 **Safe:** Spending is slower than time.
        - 🟡 **Warning:** Spending pace is matching time (+10% tolerance).
        - 🔴 **Danger:** Spending is significantly faster than time.
    - **Opt-In:** Users can enable/disable this per category.
- **Sweep Feature:** Move leftover budget from previous month to current month/savings.

### 6. Households & Collaboration
- **Multi-User:** Support for shared financial tracking (e.g., couples, families).
- **Roles:**
  - **Admin:** Can manage members and settings.
  - **Member:** Can view and add transactions.
- **Invites:** Invite system via email/code with expiration.
- **Context Switching:** Users can switch between "Personal" view and "Household" view. Data is siloed by `householdId`.

## Business Logic Rules
1.  **Deletion vs Archiving:** Prefer Archiving for Accounts and Categories to preserve historical transaction data. Hard delete is blocked if transactions exist.
2.  **Transfers:**
    - Transfer between Liquid accounts = Neutral.
    - Transfer Liquid -> Saving/Asset = "Spending" (allocating to goal).
    - **Auto-Categorization:** Transfers to accounts with linked categories automatically inherit that category.
    - Transfer Saving -> Liquid = "Income" (releasing funds).
    - **Smart Disbursement:** If a transfer is detected from Special (Saving) -> Liquid (Cash), it is automatically flagged as **Disbursement**. It increases Unassigned Cash but does **NOT** count as negative spending (to preserve historical accumulated stats) and does **NOT** auto-inflate the budget.
    - **Buyback/Sell Asset:** Treated as Income (Capital + Profit) to Unassigned Cash (if recorded as split) or Net Reversal of Spending.
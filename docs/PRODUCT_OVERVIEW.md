# Product Overview: Perfin App

**Perfin** is a modern, mobile-first Personal Finance Tracker designed for individuals and households. It emphasizes real-time synchronization, zero-based budgeting principles, and actionable goal tracking.

## Core Features

### 1. Transactions Management
- **Types:** Expense, Income, Transfer.
- **Asset Transactions (Buy/Sell):** Handled as Transfers between Liquid and Asset accounts. Backend automatically calculates:
    - **Buy:** Decreases Cash, Increases Asset Quantity/Cost Basis.
    - **Sell:** Increases Cash, Decreases Asset Quantity/Cost Basis, calculates Realized Profit.
- **Split Transactions:** Ability to split a single transaction into multiple categories. Uses a dedicated **Nested Drawer** UI for better mobile experience.
- **Filtering:** Filter by Date Range, Account, Category, and Type.
- **Analytics:** Integrated visual analytics (Donut Chart & Trend) directly within the transaction list via a swipeable tab interface.

### 2. Accounts (Funds Storage)
- **Types:**
  - **Liquid (Cash/Bank):** Used for daily spending.
  - **Savings:** Non-liquid funds reserved for specific goals.
  - **Assets:** Track value of non-monetary items (Gold, Stocks) with Quantity/Unit support.
- **Lifecycle:** Supports **Archiving/Closing** accounts.
  - *Rule:* Accounts can only be closed if Balance is 0.
- **Separation:** UI separates Liquid Assets vs Long-term Assets.

### 3. Categories & Goals
- **Types:** Expense, Income, Saving (Goal).
- **Goal Logic:**
  - A category of type `saving` is treated as a **Goal**.
  - **Target:** Has `targetAmount` and `targetDate`.
  - **Accumulation Logic:** Calculated dynamically based on (Expenses + Net Transfers into this category).
- **Lifecycle:**
  - **Active:** Normal usage.
  - **Achieved:** Goal met (handled via Wizard). Hidden from Budget list.
  - **Archived:** Manually hidden.

### 4. Goal Achievement Workflow (Unique Feature)
System automatically detects when `Accumulated Amount >= Target Amount` via backend triggers.
1.  **Notification:** User receives a "Goal Achieved" notification.
2.  **Wizard (Dialog):**
    - **Step 1:** Celebration & Action selection.
    - **Step 2 (Disbursement):** Prompt to transfer funds from *Saving Account* to *Spending Account*. Transaction flagged as `isGoalDisbursement` to avoid messing up income/expense reports.
    - **Step 3 (Cleanup):** Prompt to Close/Archive the now-empty Saving Account.
3.  **Result:** Category status updated to `achieved`.

### 5. Budgeting (Zero-Based Budgeting)
- **Monthly Budgets:** Set limits per category per month.
- **Swipeable Views:** Separate sections for "Monthly Expenses" and "Savings & Goals" navigable via swipe.
- **Real-time Tracking:** Visual progress bars synced with Dashboard.
- **Zero-Based Logic:** Tracks **Unassigned Cash** (Total Income - Total Budgeted).
    - **Strict Rule:** Ideally, Unassigned Cash should be 0.
    - **Auto-Create Zero Budget:** If a transaction is made to a category without a budget, the system automatically creates a budget with limit 0, instantly flagging it as "Over Budget" to alert the user.
- **Sweep Feature:** Move leftover budget from previous month to current month/savings.

### 6. Household & Collaboration
- Users can create or join Households.
- Data (Accounts, Transactions, Categories) is shared within the household context.
- Member roles (Admin/Member).

### 7. Dashboard
- **Daily Operations:**
    - **Remaining Monthly Budget:** Shows strict "Safe to Spend" amount (Limit - Spent) for Expenses only. Excludes Savings.
    - **Unassigned Budget:** Displays available free cash flow side-by-side.
- **Wealth & Goals:** Net worth tracking & Goal progress.
- **Logic:** Centralized calculation logic ensures Dashboard numbers always match Budget Page numbers.

## Business Logic Rules
1.  **Deletion vs Archiving:** Prefer Archiving for Accounts and Categories to preserve historical transaction data. Hard delete is available but dangerous.
2.  **Transfers:**
    - Transfer between Liquid accounts = Neutral.
    - Transfer Liquid -> Saving = "Spending" (allocating to goal).
    - Transfer Saving -> Liquid = "Income" (releasing funds), unless flagged as Disbursement.
    - **Buyback/Sell Asset:** Treated as Income (Capital + Profit) to Unassigned Cash (if recorded as split) or Net Reversal of Spending.
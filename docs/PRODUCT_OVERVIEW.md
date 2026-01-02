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
- **Linked Goals:** Creating a **Saving** or **Asset** account automatically creates a linked category (Goal) with the same name.
- **Unified Management:** Goal targets (amount and date) are managed directly within the Account management UI.
- **Lifecycle:** Supports **Archiving/Closing** accounts.
  - *Rule:* Accounts can only be closed if Balance is 0. Closing an account automatically archives its linked goal.
- **Separation:** UI separates Liquid Assets vs Long-term Assets.

### 3. Categories & Goals
- **Types:** Expense, Income, Saving (Goal).
- **Goal Logic:**
  - A category of type `saving` is treated as a **Goal**.
  - **Implicit Coupling:** Most goals are implicitly linked to specific Saving/Asset accounts.
  - **Target:** Has `targetAmount` and `targetDate`.
  - **Accumulation Logic:** Calculated dynamically based on (Expenses + Net Transfers into this category).
- **Lifecycle:**
  - **Active:** Normal usage.
  - **Achieved:** Goal met (handled via Wizard). Hidden from Budget list.
  - **Archived:** Manually hidden or automatically hidden when the linked account is closed.

...

### 5. Budgeting (Zero-Based Budgeting)
- **Monthly Budgets:** Set limits per category per month.
- **Swipeable Views:** Separate sections for "Monthly Expenses" and "Savings & Goals" navigable via swipe.
- **Real-time Tracking:** Visual progress bars synced with Dashboard.
- **Zero-Based Logic:** Tracks **Unassigned Cash** (Total Income - Total Budgeted).
    - **Strict Rule:** Ideally, Unassigned Cash should be 0.
    - **Smart Auto-Budgeting:** If a transaction is made to a category without a budget, the system automatically creates a budget with the **transaction amount**. This prevents "false alarm" over-budget warnings while maintaining zero-based integrity.
- **Sweep Feature:** Move leftover budget from previous month to current month/savings.

...

## Business Logic Rules
1.  **Deletion vs Archiving:** Prefer Archiving for Accounts and Categories to preserve historical transaction data. Hard delete is available but dangerous.
2.  **Transfers:**
    - Transfer between Liquid accounts = Neutral.
    - Transfer Liquid -> Saving/Asset = "Spending" (allocating to goal).
    - **Auto-Categorization:** Transfers to accounts with linked categories automatically inherit that category for tracking progress.
    - Transfer Saving -> Liquid = "Income" (releasing funds), unless flagged as Disbursement.
    - **Buyback/Sell Asset:** Treated as Income (Capital + Profit) to Unassigned Cash (if recorded as split) or Net Reversal of Spending.
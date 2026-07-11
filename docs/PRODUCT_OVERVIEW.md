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
- **Filtering:** Powerful **Multi-Select Filtering** allows users to combine multiple Accounts, Categories, or Types simultaneously. Supports Date Range filtering.

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

### 5. Budgeting (Zero-Based Budgeting)
- **Monthly Budgets:** Set limits per category per month.
- **Swipeable Views:** Separate sections for "Monthly Expenses" and "Savings & Goals" navigable via swipe.
- **Move Money (Rule 3):**
    - Users can easily move funds from **Unassigned Cash** or **Other Categories** to cover overspending or assign funds.
    - **Smart Drawer:** Budget drawer features "Set Limit" with quick-adjust preset buttons and real-time preview of remaining balance. **Move Funds** has its own dedicated drawer accessible via the "Move Funds" button in the budget page action bar, supporting transfers between categories and Unassigned Cash with real-time preview of remaining budgets.
- **Real-time Tracking:** Visual progress bars synced with Dashboard.
    - **Expense Budget:** Tracks `Spent / Limit`.
    - **Savings/Goals Budget:** Tracks `Monthly Contribution / Monthly Target`. Shows a **"Monthly Goal Met"** celebration badge when the monthly saving target is reached.
- **Zero-Based Logic:** Tracks **Unassigned Cash** (Total Income - Total Budgeted).
    - **Budget Transparency:** The system distinguishes between **New Planned (Assigned)** money for the current month and **Effective Spending Power** (which includes adjustments like rollovers).
    - **Settlement Integrity:** Income categorized into an expense category (reimbursements/settlements) acts as **Negative Spending**, accurately increasing the available budget for that category.
    - **Strict Rule:** Ideally, Unassigned Cash should be 0.
    - **Flexible Overspending:** Overspending in a category results in a **Negative Available** balance. 
- **Month-End Processing (Review & Process):**
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
- **Scope:** Respects current active filters (Date Range, Type, Account, Category, Label).
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
